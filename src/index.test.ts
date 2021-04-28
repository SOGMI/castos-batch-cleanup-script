import { getDateFromFilename } from "./index";

test("Date From Filename", () => {
    const result1 = getDateFromFilename(
        "02-20-21-21-Prophetic-Voice-of-our-Time-[mixdown]-01.mp3"
    );
    expect(result1).toStrictEqual(new Date("02/22/2021 10:00 AM CST"));

    const result2 = getDateFromFilename(
        "TPVOT-E363-19-03-16-17-Entering-the-Promised-Land.mp3"
    );
    expect(result2).toStrictEqual(new Date("03/18/2019 10:00 AM CST"));

    const result3 = getDateFromFilename(
        "TPVOT-E365-19-03-30-31-Uproot-the-False-Narratives-in-Your-Life.mp3"
    );
    expect(result3).toStrictEqual(new Date("04/01/2019 10:00 AM CST"));

    const result4 = getDateFromFilename(
        "02-29-20-03-01-20-Prophetic-Voice-of-our-Time-[mixdown]-01.mp3"
    );
    expect(result4).toStrictEqual(new Date("03/02/2020 10:00 AM CST"));
});
