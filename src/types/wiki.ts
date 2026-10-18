/** The old wiki's manifest. Only its topics are still read, for the home "currently orbiting" chips. */
export interface WikiManifest {
  topics: WikiTopic[];
}

export interface WikiTopic {
  id: string;
  label: string;
  dotColor: string;
}
