import express from 'express';
import compression from 'compression';
import sslifyEnforce from 'express-sslify';
import path from 'path';
import axios from 'axios';
import url from 'url';
import ioredis from 'ioredis';

const app = express();
app.use(compression());

const env = process.env.NODE_ENV || 'development';
if (env === 'production') {
  app.use(sslifyEnforce.HTTPS({ trustProtoHeader: true }));
}

app.use(express.static(__dirname + '/public'));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

const soundcloudClientId = process.env.SOUNDCLOUD_CLIENT_ID + '';
const soundcloudClientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET + '';

app.use(express.json());
app.post('/api/resolve', async (req, res) => {
  try {
    if (req.body.constructor !== Object || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    if (
      req.body.url === undefined ||
      req.body.url === null ||
      !(typeof req.body.url === 'string' || req.body.url instanceof String)
    ) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const urlToResolve = req.body.url + '';

    const resolved = await new SoundcloudApi(
      soundcloudClientId,
      soundcloudClientSecret
    ).resolve(urlToResolve);
    res.json({
      stream_url: resolved.streamUrl,
      url: resolved.url,
      title: resolved.title,
      artwork: resolved.artwork,
      user: resolved.user,
    });
  } catch (e: unknown) {
    if (e instanceof SoundcloudApiHttpError) {
      res.sendStatus(e.status);
    } else {
      res.sendStatus(500);
    }
  }
});

const REDIS_PREFIX = 'vizl:';
const redis =
  env === 'production'
    ? new ioredis(process.env.REDIS_TLS_URL, {
        tls: { rejectUnauthorized: false },
        keyPrefix: REDIS_PREFIX,
      })
    : new ioredis({ keyPrefix: REDIS_PREFIX });

const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log('Express: listening on port ' + port);
});

const SOUNDCLOUD_API_BASE_URL = 'https://api.soundcloud.com';
const SOUNDCLOUD_OAUTH_TOKEN_API_URL = `${SOUNDCLOUD_API_BASE_URL}/oauth2/token`;
const SOUNDCLOUD_RESOLVE_API_URL = `${SOUNDCLOUD_API_BASE_URL}/resolve`;

const SOUNDCLOUD_ACCESS_TOKEN_KEY = 'soundcloud-access-token';

class SoundcloudApiHttpError extends Error {
  constructor(public status: number) {
    super('Soundcloud API error');

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, SoundcloudApiHttpError.prototype);
  }
}

class SoundcloudApi {
  accessToken: string | null = null;

  constructor(private clientId: string, private clientSecret: string) {}

  // Get the resolved streaming URL for the link provided
  public async resolve(trackUrl: string): Promise<{
    streamUrl: string;
    url: string;
    title: string;
    artwork: string | null;
    user: { name: string; profile: string };
  }> {
    await this.auth();

    const resolveUrl = new URL(SOUNDCLOUD_RESOLVE_API_URL);
    resolveUrl.searchParams.append('url', trackUrl);

    const resolvedRes = await axios.get(resolveUrl.toString(), {
      headers: { Authorization: `OAuth ${this.accessToken}` },
      validateStatus: (_s) => true,
    });
    if (resolvedRes.status !== 200) {
      throw new SoundcloudApiHttpError(resolvedRes.status);
    }

    const trackData = resolvedRes.data;
    const redirectRes = await axios.get(trackData.stream_url, {
      headers: { Authorization: `OAuth ${this.accessToken}` },
      validateStatus: (_s) => true,
      maxRedirects: 0,
    });
    if (
      redirectRes.status !== 302 ||
      !redirectRes.data.location ||
      (redirectRes.data.location + '').length === 0
    ) {
      throw new SoundcloudApiHttpError(redirectRes.status);
    }

    return {
      streamUrl: redirectRes.data.location,
      url: trackData.permalink_url,
      title: trackData.title,
      artwork: trackData.artwork_url ?? null,
      user: {
        name: trackData.user.username,
        profile: trackData.user.permalink_url,
      },
    };
  }

  // Returns access token from client credentials flow
  private async auth() {
    if (this.accessToken !== null) {
      return;
    }

    let accessToken = await redis.get(SOUNDCLOUD_ACCESS_TOKEN_KEY);
    if (accessToken === null || accessToken === undefined) {
      const res = await axios.post(
        SOUNDCLOUD_OAUTH_TOKEN_API_URL,
        new url.URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
        { validateStatus: (_s) => true }
      );

      if (res.status !== 200) {
        throw new SoundcloudApiHttpError(res.status);
      }

      accessToken = res.data.access_token + '';

      const expireSeconds = parseInt(res.data.expires_in);
      if (!isNaN(expireSeconds)) {
        const r = await redis.set(
          SOUNDCLOUD_ACCESS_TOKEN_KEY,
          accessToken,
          'EX',
          Math.floor(expireSeconds / 2)
        );
      }

      console.log('SoundcloudApi: set new access token in redis');
    } else {
      console.log('SoundcloudApi: found existing access token in redis');
    }

    this.accessToken = accessToken;
  }
}
