export {};

declare global {
  interface Body {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(): Promise<any>;
  }
}
