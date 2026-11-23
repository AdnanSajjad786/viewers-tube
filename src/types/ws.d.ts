declare module "ws" {
  // Runtime implementation remains provided by the installed ws package.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WebSocket: any;
  export default WebSocket;
}
