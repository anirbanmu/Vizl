<footer>
  <space-holder>
    <a href="https://soundcloud.com/" target="_blank">
      <img
        src="/static/powered_by_white-371bd6967352fcc89673d4c81f7e5661.png"
        alt="powered by SoundCloud®"
        class="powered-by-soundcloud"
      />
    </a>
  </space-holder>

  <text-footer>
    Source @
    <a href="https://github.com/anirbanmu/Vizl" target="_blank">Github</a>. Code
    & visualizations by
    <a href="https://github.com/anirbanmu" target="_blank"
      >Anirban Mukhopadhyay</a
    >. Layout help by
    <a href="https://www.flickr.com/photos/dickbaker" target="_blank"
      >Dick Baker</a
    >. Logo contributed by a cup of noodles.
  </text-footer>

  <image-footer>
    <a href="https://soundcloud.com/" target="_blank">
      <img
        src="/static/powered_by_white-371bd6967352fcc89673d4c81f7e5661.png"
        alt="powered by SoundCloud®"
        class="powered-by-soundcloud"
      />
    </a>
  </image-footer>
</footer>

<style>
  footer {
    position: relative;
    width: 90%;
    margin: 0em auto 0 auto;
    padding-left: 0.8em;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99;
    font-size: 0.7em;
    transition: all 60ms;
    opacity: 0.6;
  }

  footer:hover {
    opacity: 1;
  }

  space-holder {
    padding: 1em 1em 0.3em 1em;
    margin-right: auto;
    visibility: hidden;
  }

  text-footer {
    padding: 1em 1em 0.3em 1em;
  }

  image-footer {
    margin-left: auto;
    padding: 1em 1em 0.3em 1em;
  }

  .powered-by-soundcloud {
    max-width: 5.8em;
    width: 5.8em;
  }
</style>
