import { ResourceMap } from "./ResourceMap";

/**
 * Player - Client-side player representation
 * Player state is managed by the server, this is just for display
 */
export class Player {
  type: "day" | "night";
  resources: ResourceMap;

  constructor({
    type,
    resources,
  }: {
    type: "day" | "night";
    resources?: ResourceMap;
  }) {
    this.type = type;
    this.resources = resources ?? new ResourceMap({});
  }
}
