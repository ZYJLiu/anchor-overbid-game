import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { faker } from "@faker-js/faker";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { program } from "@/anchor/setup";

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

type CharacterType = "superhero" | "occupation";

function generateRandomCharacterName() {
  const characterNames: Record<CharacterType, () => string> = {
    superhero: () =>
      `${faker.person.firstName()} the ${faker.word.adjective()}`,
    occupation: () => `${faker.person.jobTitle()} ${faker.person.lastName()}`,
    // elemental: () =>
    //   `${faker.person.firstName()} ${["Fire", "Water", "Earth", "Air", "Lightning"][Math.floor(Math.random() * 5)]}heart`,
  };

  const nameTypes = Object.keys(characterNames) as CharacterType[];
  const randomType = nameTypes[Math.floor(Math.random() * nameTypes.length)];

  const rawName = characterNames[randomType]();
  const name = rawName.replace(/\b\w/g, (char) => char.toUpperCase());
  const lowercaseName = name.toLowerCase().replace(/\s+/g, "-");

  return {
    name: name,
    lowercaseName: lowercaseName,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { uri, account } = await req.json();

    console.log(account);

    if (!uri) {
      return NextResponse.json({ error: "No URI provided" }, { status: 400 });
    }

    if (!account) {
      return new Response(
        JSON.stringify({
          error: "Required data missing. Account not provided.",
        }),
        { status: 400 },
      );
    }

    // Download image from URI
    const imageResponse = await fetch(uri);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Generate a unique ID for the image and JSON
    const { name, lowercaseName } = generateRandomCharacterName();
    console.log(name, lowercaseName);

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
      description: "An item in the Overbid game",
      image: imageUrl,
      // Add other metadata fields as needed
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
        payer: new PublicKey(account),
        mintAccount: mintKeypair.publicKey,
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // create new Transaction and add instruction
    const transaction = new Transaction({
      feePayer: new PublicKey(account),
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
    }).add(instruction);

    transaction.partialSign(mintKeypair);
    const serializedtx = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json(
      {
        imageUrl,
        jsonUrl,
        metadata,
        transaction: serializedtx,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
