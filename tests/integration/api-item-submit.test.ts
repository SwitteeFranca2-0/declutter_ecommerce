/**
 * POST /api/items, at the route-handler seam.
 *
 * SELL-1, AUTH-3, AUTH-6. A seller offers an item and it lands in
 * `pending_review`, invisible to buyers. The risky parts are what the server
 * refuses to take from the request: status, price, ownership, and a file that
 * is not the image it claims to be.
 */

import { readdir, rm } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser, resetDb, testDb } from "../helpers/db";
import { postForm } from "../helpers/request";

const UPLOADS = process.env.UPLOADS_DIR as string;

async function uploadedFiles(): Promise<string[]> {
  try {
    return await readdir(UPLOADS);
  } catch {
    return [];
  }
}

beforeEach(async () => {
  await resetDb();
  await rm(UPLOADS, { recursive: true, force: true });
});

afterAll(async () => {
  await resetDb();
  await rm(UPLOADS, { recursive: true, force: true });
  await testDb.$disconnect();
});

const { POST } = await import("@/app/api/items/route");

/** Smallest bytes that are genuinely a PNG, so the type check passes honestly. */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function imageFile(name = "photo.png", bytes: Uint8Array = PNG_BYTES) {
  return new File([bytes as BlobPart], name, { type: "image/png" });
}

const FIELDS = {
  title: "Yamaha F310 acoustic guitar",
  description: "Barely played.\n\nComes with a soft case.",
  category: "other",
  condition: "good",
  requestedPayout: "60000.00",
};

function submission(
  overrides: Record<string, string> = {},
  files: File[] = [imageFile()],
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...FIELDS, ...overrides })) {
    if (value !== undefined) form.append(key, value);
  }
  for (const file of files) form.append("images", file);
  return form;
}

async function verifiedSeller(email = "seller@test.local") {
  return makeUser("seller", { email, phoneVerified: true });
}

const submit = (form: FormData, as: { email: string } | null) =>
  postForm(POST, "/api/items", form, { as });

describe("submitting an item, SELL-1", () => {
  it("creates the item against the signed-in seller, awaiting review", async () => {
    const seller = await verifiedSeller();

    const { status, body } = await submit(submission(), { email: seller.email });

    expect(status).toBe(201);
    expect(body.item).toMatchObject({ title: FIELDS.title, status: "pending_review" });

    const item = await testDb.item.findFirstOrThrow({ include: { images: true } });
    expect(item.sellerId).toBe(seller.id);
    expect(item.status).toBe("pending_review");
    expect(item.category).toBe("other");
    expect(item.condition).toBe("good");
    expect(item.description).toBe(FIELDS.description);
  });

  it("stores the requested payout exactly, and prices nothing yet", async () => {
    const seller = await verifiedSeller();

    await submit(submission({ requestedPayout: "60000.00" }), { email: seller.email });

    const item = await testDb.item.findFirstOrThrow();
    expect(item.sellerPayoutAmount.toString()).toBe("60000");
    // Provisional: equal to the payout until an admin prices it in slice 09,
    // and never shown because the item is not listed.
    expect(item.listedPrice.toString()).toBe("60000");
  });

  it("keeps the item out of the marketplace entirely", async () => {
    const { getListedItem, getListedItems } = await import("@/lib/items");
    const seller = await verifiedSeller();

    await submit(submission(), { email: seller.email });
    const item = await testDb.item.findFirstOrThrow();

    expect(await getListedItems()).toEqual([]);
    expect(await getListedItem(item.id)).toBeNull();
  });

  it("stores images in the order they were uploaded, lowest sortOrder first", async () => {
    const seller = await verifiedSeller();

    await submit(
      submission({}, [imageFile("first.png"), imageFile("second.png"), imageFile("third.png")]),
      { email: seller.email },
    );

    const images = await testDb.itemImage.findMany({ orderBy: { sortOrder: "asc" } });
    expect(images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(await uploadedFiles()).toHaveLength(3);
    // The url is a public path, the shape the seed and the catalogue already use.
    expect(images[0].url.startsWith("/uploads/")).toBe(true);
  });

  it("keeps a hostile title and description as text, T-XSS", async () => {
    const seller = await verifiedSeller();
    const hostile = '<script>alert("xss")</script>';

    await submit(submission({ title: hostile, description: hostile }), {
      email: seller.email,
    });

    const item = await testDb.item.findFirstOrThrow();
    expect(item.title).toBe(hostile);
    expect(item.description).toBe(hostile);
  });
});

describe("what the server will not take from the request", () => {
  it("ignores a status, a price, a seller and an approver in the body", async () => {
    const seller = await verifiedSeller();
    const otherSeller = await verifiedSeller("other.seller@test.local");
    const admin = await makeUser("admin");

    const { status } = await submit(
      submission({
        status: "listed",
        listedPrice: "1",
        sellerId: otherSeller.id,
        approvedById: admin.id,
      }),
      { email: seller.email },
    );

    expect(status).toBe(201);
    const item = await testDb.item.findFirstOrThrow();
    expect(item.status).toBe("pending_review");
    expect(item.listedPrice.toString()).toBe("60000");
    expect(item.sellerId).toBe(seller.id);
    expect(item.approvedById).toBeNull();
  });
});

describe("the guard, AUTH-6 and AUTH-3", () => {
  it("refuses a signed-out submission with 401, writing nothing", async () => {
    const { status } = await submit(submission(), null);

    expect(status).toBe(401);
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });

  it("refuses a buyer with 403, writing nothing", async () => {
    const buyer = await makeUser("buyer");

    const { status } = await submit(submission(), { email: buyer.email });

    expect(status).toBe(403);
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });

  it("refuses an unverified seller with 403 and names the verification page", async () => {
    const seller = await makeUser("seller", {
      email: "unverified.seller@test.local",
      phoneVerified: false,
    });

    const { status, body } = await submit(submission(), { email: seller.email });

    expect(status).toBe(403);
    expect(body.verifyPath).toBe("/verify-phone");
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });
});

describe("the files", () => {
  it("refuses a submission with no image", async () => {
    const seller = await verifiedSeller();

    const { status } = await submit(submission({}, []), { email: seller.email });

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
  });

  it("refuses a file that is not an image, whatever it claims to be", async () => {
    const seller = await verifiedSeller();
    const liar = new File(["#!/bin/sh\necho hello" as BlobPart], "payload.png", {
      type: "image/png",
    });

    const { status } = await submit(submission({}, [liar]), { email: seller.email });

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });

  it("refuses a file over the size ceiling", async () => {
    const seller = await verifiedSeller();
    const huge = new File([new Uint8Array(6 * 1024 * 1024) as BlobPart], "big.png", {
      type: "image/png",
    });

    const { status } = await submit(submission({}, [huge]), { email: seller.email });

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
  });

  it("refuses more files than the cap", async () => {
    const seller = await verifiedSeller();
    const many = Array.from({ length: 9 }, (_, i) => imageFile(`photo-${i}.png`));

    const { status } = await submit(submission({}, many), { email: seller.email });

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
  });

  it("does not let a crafted filename decide where the file lands", async () => {
    const seller = await verifiedSeller();
    const nasty = imageFile("../../../../etc/declutter-escape.png");

    const { status } = await submit(submission({}, [nasty]), { email: seller.email });

    expect(status).toBe(201);
    const image = await testDb.itemImage.findFirstOrThrow();
    expect(image.url).not.toContain("..");
    expect(image.url).toMatch(/^\/uploads\/[A-Za-z0-9._-]+$/);
    const files = await uploadedFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).not.toContain("etc");
  });

  it("gives two files with the same name distinct stored names", async () => {
    const seller = await verifiedSeller();

    await submit(submission({}, [imageFile("photo.png"), imageFile("photo.png")]), {
      email: seller.email,
    });

    const images = await testDb.itemImage.findMany();
    expect(new Set(images.map((i) => i.url)).size).toBe(2);
    expect(await uploadedFiles()).toHaveLength(2);
  });

  it("leaves no file behind when the submission is refused after a valid one", async () => {
    const seller = await verifiedSeller();

    const { status } = await submit(
      submission({}, [imageFile("good.png"), new File(["nope" as BlobPart], "bad.png", { type: "image/png" })]),
      { email: seller.email },
    );

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });
});

describe("validation at the boundary", () => {
  it.each([
    ["a missing title", { title: "" }],
    ["an over-long title", { title: "x".repeat(121) }],
    ["a missing description", { description: "" }],
    ["an unknown category", { category: "spaceships" }],
    ["an unknown condition", { condition: "mint" }],
    ["a payout of zero", { requestedPayout: "0" }],
    ["a negative payout", { requestedPayout: "-500" }],
    ["a payout that is not a number", { requestedPayout: "a lot" }],
    ["a payout with three decimal places", { requestedPayout: "100.005" }],
  ])("refuses %s", async (_case, override) => {
    const seller = await verifiedSeller();

    const { status } = await submit(submission(override), { email: seller.email });

    expect(status).toBe(400);
    expect(await testDb.item.count()).toBe(0);
    expect(await uploadedFiles()).toEqual([]);
  });

  it("refuses a body that is not multipart form data", async () => {
    const seller = await verifiedSeller();
    const { actAs } = await import("../helpers/session-state");
    actAs(seller.email);

    const response = await POST(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(FIELDS),
      }),
    );

    expect(response.status).toBe(400);
  });
});
