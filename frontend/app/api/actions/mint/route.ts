import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { faker } from "@faker-js/faker";
import { program } from "@/anchor/setup";
// import { fetchAllItems } from "@/app/actions";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL!;

async function uploadToS3(
  key: string,
  body: Buffer | string,
  contentType: string,
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return `${CLOUDFRONT_URL}/${key}`;
}

function generateRandomCharacterName() {
  const characterNames = {
    superhero: () =>
      `${faker.person.firstName()} the ${faker.word.adjective()}`,
    occupation: () => `${faker.person.jobTitle()} ${faker.person.lastName()}`,
  };

  const nameTypes = Object.keys(characterNames);
  const randomType = nameTypes[Math.floor(Math.random() * nameTypes.length)];

  // @ts-ignore
  const rawName = characterNames[randomType]();
  // @ts-ignore
  const name = rawName.replace(/\b\w/g, (char) => char.toUpperCase());
  const lowercaseName = name.toLowerCase().replace(/\s+/g, "-");

  return { name, lowercaseName };
}

const character = {
  skin: 2000,
};

const data = {
  region: "GMS",
  version: "247",
};
interface Item {
  id: number;
  typeInfo: {
    category: string;
    subCategory?: string;
  };
}

async function fetchAllItems(): Promise<Item[]> {
  const response = await fetch("https://maplestory.io/api/GMS/247/item");
  if (!response.ok) {
    throw new Error("Failed to fetch items");
  }
  return response.json();
}

function filterItemsByCategory(
  items: Item[],
  category: string,
  subCategory?: string,
): Item[] {
  return items.filter(
    (item) =>
      item.typeInfo.category === category &&
      (!subCategory || item.typeInfo.subCategory === subCategory),
  );
}

async function generateRandomCharacter() {
  const allItems = await fetchAllItems();

  const weaponType =
    Math.random() < 0.5 ? "One-Handed Weapon" : "Two-Handed Weapon";
  const isOverall = Math.random() < 0.5;
  const poseOptions = ["alert", "stand1"];
  let pose = poseOptions[Math.floor(Math.random() * poseOptions.length)];

  if (pose !== "alert") {
    pose = weaponType === "One-Handed Weapon" ? "stand1" : "alert";
  }

  const categories = [
    { category: weaponType },
    ...(weaponType === "One-Handed Weapon"
      ? [{ category: "Armor", subCategory: "Shield" }]
      : []),
    ...(isOverall
      ? [{ category: "Armor", subCategory: "Overall" }]
      : [
          { category: "Armor", subCategory: "Top" },
          { category: "Armor", subCategory: "Bottom" },
        ]),
    { category: "Armor", subCategory: "Glove" },
    { category: "Armor", subCategory: "Cape" },
    { category: "Armor", subCategory: "Hat" },
    { category: "Armor", subCategory: "Shoes" },
    { category: "Character", subCategory: "Face" },
    { category: "Character", subCategory: "Hair" },
    { category: "Accessory", subCategory: "Eye Decoration" },
    { category: "Accessory", subCategory: "Face Accessory" },
    { category: "Accessory", subCategory: "Earrings" },
  ];

  const items = [
    { itemId: character.skin, region: data.region, version: data.version },
    {
      itemId: character.skin + 10000,
      region: data.region,
      version: data.version,
    },
  ];

  categories.forEach(({ category, subCategory }) => {
    const filteredItems = filterItemsByCategory(
      allItems,
      category,
      subCategory,
    );
    if (filteredItems.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredItems.length);
      const selectedItem = filteredItems[randomIndex];
      items.push({
        itemId: selectedItem.id,
        region: data.region,
        version: data.version,
      });
    }
  });

  const params = items
    .map((item) => encodeURIComponent(JSON.stringify(item)))
    .join(",");
  const baseUrl = `https://maplestory.io/api/character/${params}/${pose}`;
  const queryParams = "showears=false&showLefEars=false&name=&flipX=false";

  return `${baseUrl}/animated?${queryParams}`;
}

export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const payload: ActionGetResponse = {
      title: "Mint Action",
      icon: new URL("/chibi.jpeg", requestUrl.origin).toString(),
      description: "Mint a randomly generated character in Overbid Game",
      label: "Mint",
    };

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    console.error(err);
    return new Response("An error occurred", {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      throw 'Invalid "account" provided';
    }

    // Generate random character URI
    const uri = await generateRandomCharacter();

    // Download image from URI
    const imageResponse = await fetch(uri);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Generate a unique ID for the image and JSON
    const { name, lowercaseName } = generateRandomCharacterName();

    // Upload image to S3
    const imageKey = `image/${lowercaseName}.png`;
    const imageUrl = await uploadToS3(
      imageKey,
      Buffer.from(imageBuffer),
      "image/png",
    );

    // Create JSON metadata
    const metadata = {
      name: `${name}`,
      description: "A randomly generated NFT",
      image: imageUrl,
    };

    // Upload JSON to S3
    const jsonKey = `json/${lowercaseName}.json`;
    const jsonUrl = await uploadToS3(
      jsonKey,
      JSON.stringify(metadata),
      "application/json",
    );

    const connection = program.provider.connection;
    const mintKeypair = new Keypair();
    const instruction = await program.methods
      .mint(jsonUrl)
      .accounts({
        payer: account,
        mintAccount: mintKeypair.publicKey,
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: account,
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
    }).add(instruction);

    transaction.partialSign(mintKeypair);

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Mint: ${name}`,
      },
      signers: [mintKeypair],
    });

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    console.error("Error processing mint:", err);
    return new Response(
      typeof err === "string" ? err : "An unknown error occurred",
      {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      },
    );
  }
};
