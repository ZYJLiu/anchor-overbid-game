import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { program } from "@/anchor/setup";
import { BN } from "@coral-xyz/anchor";
import { getTokenMetadata } from "@solana/spl-token";

export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const mint = requestUrl.searchParams.get("mint");

    if (!mint) {
      throw "Mint address is required";
    }

    const connection = program.provider.connection;
    const metadata = await getTokenMetadata(connection, new PublicKey(mint));

    const overbid = Number(metadata?.additionalMetadata[0][1]) || 0;
    const owner = metadata?.additionalMetadata[1][1].toString() || "Unknown";
    console.log(owner);
    const minimumBid = (overbid + 10_000_000) / LAMPORTS_PER_SOL; // 0.01 SOL more than current bid
    console.log(minimumBid);

    const uri = metadata?.uri;

    let image = "";
    if (uri) {
      try {
        const uriResponse = await fetch(uri);
        const uriData = await uriResponse.json();
        image = uriData.image || "";
      } catch (error) {
        console.error("Error fetching URI data:", error);
      }
    }

    const baseHref = new URL(
      `/api/actions/bid?mint=${mint}&owner=${owner}`,
      requestUrl.origin,
    ).toString();

    // const baseHref = new URL(`/api/actions/bid`, requestUrl.origin).toString();

    const payload: ActionGetResponse = {
      title: "Bid Action",
      icon: image,
      description: `Buy an item in the Overbid Game.
        Item Details,
        Mint Address: ${mint},
        Current Owner: ${owner},
        Minimum Bid: ${minimumBid} SOL`,
      label: "Bid",
      links: {
        actions: [
          {
            label: "Buy",
            href: `${baseHref}&amount=${minimumBid}`,
          },
          {
            label: "Custom Bid",
            href: `${baseHref}&amount={amount}`,
            parameters: [
              {
                name: "amount",
                label: `Minimum: ${minimumBid} SOL`,
                required: true,
              },
            ],
          },
        ],
      },
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

export const OPTIONS = async (req: Request) => {
  return new Response(null, {
    status: 200,
    headers: {
      ...ACTIONS_CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
};

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    console.log(requestUrl);
    const mint = requestUrl.searchParams.get("mint");
    const owner = requestUrl.searchParams.get("owner");
    const amount = requestUrl.searchParams.get("amount");

    console.log("test");

    const body: ActionPostRequest = await req.json();
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      throw 'Invalid "account" provided';
    }

    if (!mint || !owner || !amount) {
      throw "Missing required parameters";
    }

    // const mint = new PublicKey("Gm1PfFXAGLS5mcszfgLv5PexcvmpUTUHoHWfWPYj6gaP");
    const connection = program.provider.connection;
    // const metadata = await getTokenMetadata(connection, new PublicKey(mint));

    // const overbid = Number(metadata?.additionalMetadata[0][1]);
    // const owner = metadata?.additionalMetadata[1][1].toString();
    // console.log(owner);
    // const minimumBid = overbid + 10_000_000; // 0.01 SOL more than current bid
    // console.log(minimumBid);

    // const connection = program.provider.connection;
    // const bidAmount = new BN(minimumBid);

    const bidAmount = Number(amount) * LAMPORTS_PER_SOL;

    const instruction = await program.methods
      .bid(new BN(bidAmount))
      .accounts({
        payer: account,
        owner: new PublicKey(owner),
        mintAccount: new PublicKey(mint),
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: account,
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight,
    }).add(instruction);

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Overbid: ${amount} SOL for Item ${mint}`,
      },
    });

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (err) {
    console.error("Error processing bid:", err);
    return new Response(
      typeof err === "string" ? err : "An unknown error occurred",
      {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      },
    );
  }
};
