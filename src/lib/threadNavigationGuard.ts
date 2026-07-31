export type ThreadCreationResult = {
  id: string;
  activated: boolean;
};

/** Prevents late thread creation responses from replacing newer navigation. */
export class ThreadNavigationGuard {
  #generation = 0;

  beginCreation() {
    this.#generation += 1;
    return this.#generation;
  }

  navigate() {
    this.#generation += 1;
  }

  shouldActivate(creationGeneration: number) {
    return creationGeneration === this.#generation;
  }
}
