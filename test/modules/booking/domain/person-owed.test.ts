import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { personOwedOnBooking } from "@/modules/booking/domain/person-owed";

const bookingLeft = new Decimal("10.00");
const playerLeft = new Decimal("4.29");

describe("personOwedOnBooking", () => {
  it("puts the booking remaining on the requester when the mode is WHOLE", () => {
    expect(
      personOwedOnBooking({
        collectionMode: "WHOLE",
        isRequester: true,
        bookingRemainingUsd: bookingLeft,
        participantRemainingUsd: playerLeft,
      }).equals(bookingLeft),
    ).toBe(true);
  });

  it("owes nothing to a non-requester when the mode is WHOLE", () => {
    expect(
      personOwedOnBooking({
        collectionMode: "WHOLE",
        isRequester: false,
        bookingRemainingUsd: bookingLeft,
        participantRemainingUsd: playerLeft,
      }).equals(0),
    ).toBe(true);
  });

  it("uses that participant's remaining when the mode is PER_PLAYER", () => {
    expect(
      personOwedOnBooking({
        collectionMode: "PER_PLAYER",
        isRequester: false,
        bookingRemainingUsd: bookingLeft,
        participantRemainingUsd: playerLeft,
      }).equals(playerLeft),
    ).toBe(true);
    expect(
      personOwedOnBooking({
        collectionMode: "PER_PLAYER",
        isRequester: true,
        bookingRemainingUsd: bookingLeft,
        participantRemainingUsd: new Decimal("4.28"),
      }).equals("4.28"),
    ).toBe(true);
  });
});
