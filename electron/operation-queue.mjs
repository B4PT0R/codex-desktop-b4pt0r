/** Serializes state transitions while letting each caller observe its own result. */
export class OperationQueue {
  #tail = Promise.resolve();

  run(operation) {
    const result = this.#tail.then(operation, operation);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
