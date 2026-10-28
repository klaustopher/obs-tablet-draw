# obs-tablet-draw

## 1.1.0

### Minor Changes

- [#3](https://github.com/klaustopher/obs-tablet-draw/pull/3) [`9137439`](https://github.com/klaustopher/obs-tablet-draw/commit/913743909a30a28ce62b6f9d893008a1bda940ea) Thanks [@klaustopher](https://github.com/klaustopher)! - Enter the OBS WebSocket password and port in the app instead of the URL. They are stored on the tablet and can be changed via the connection status, so the password no longer leaks when the browser window is shown on stream.

## 1.0.1

### Patch Changes

- [#1](https://github.com/klaustopher/obs-tablet-draw/pull/1) [`9edf5a7`](https://github.com/klaustopher/obs-tablet-draw/commit/9edf5a70cdea2ba47bba78a67847a7e7bce7f046) Thanks [@klaustopher](https://github.com/klaustopher)! - Properly detect if OBS is reachable or if the provided websocket password is wrong. Do not allow drawing until a proper connection has been established.
