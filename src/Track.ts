export default interface Track {
  streamUrl: string;
  url: string;
  title: string;
  artwork: string | null;
  user: { name: string; profile: string };
}
