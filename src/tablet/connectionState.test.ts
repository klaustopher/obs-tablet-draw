import { describe, expect, it } from "vitest"
import { stateAfterClose } from "./connectionState"

describe("stateAfterClose", () => {
  it("reports OBS as unreachable when the socket never opened", () => {
    expect(stateAfterClose(false, 1006, true)).toBe("unreachable")
    expect(stateAfterClose(false, 1006, false)).toBe("unreachable")
  })

  it("tells a missing password from a wrong one", () => {
    expect(stateAfterClose(true, 4009, false)).toBe("password-missing")
    expect(stateAfterClose(true, 4009, true)).toBe("wrong-password")
  })

  it("reconnects after any other close", () => {
    expect(stateAfterClose(true, 1001, true)).toBe("connecting")
    expect(stateAfterClose(true, 1006, false)).toBe("connecting")
  })
})
