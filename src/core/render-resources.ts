import type { ResourceMap } from "@shared/player/resource-map";

export const renderResourcesInDOM = (resourceMap: ResourceMap): void => {
  const woodElement = document.getElementById("wood");
  const stoneElement = document.getElementById("stone");
  const goldElement = document.getElementById("gold");
  const foodElement = document.getElementById("food");

  if (woodElement !== null) {
    woodElement.textContent = resourceMap.wood.toString();
  }
  if (stoneElement !== null) {
    stoneElement.textContent = resourceMap.stone.toString();
  }
  if (goldElement !== null) {
    goldElement.textContent = resourceMap.gold.toString();
  }
  if (foodElement !== null) {
    foodElement.textContent = resourceMap.food.toString();
  }
};
