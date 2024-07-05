"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { convertUrlToResizedFile } from "./stable-diffusion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

interface UploadButtonProps {
  imageSrc: string;
}

export function MintButton({ imageSrc }: UploadButtonProps) {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    imageUrl: string;
    jsonUrl: string;
    metadata: any;
    transaction: string;
  } | null>(null);
  const [txSig, setTxSig] = useState("");

  // console.log(imageSrc);
  //   const convertedImage = convertUrlToResizedFile(imageSrc);
  const handleClick = async () => {
    setIsLoading(true);
    try {
      // const response = await fetch("/api/upload-metadata", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ uri: imageSrc }),
      // });

      const response = await fetch("/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uri: imageSrc, account: publicKey?.toBase58() }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();

      const transaction = Transaction.from(
        Buffer.from(data.transaction, "base64"),
      );

      const transactionSignature = await sendTransaction(
        transaction,
        connection,
      );

      console.log(transactionSignature);

      setTxSig(transactionSignature);
      setResult(data);
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Button
        disabled={isLoading || imageSrc === "" || !connected}
        onClick={handleClick}
        className="mb-2 mt-2 flex w-20 max-w-xs items-center justify-center"
      >
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Mint"}
      </Button>

      {result && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{result.metadata.name}</CardTitle>
            <CardDescription>Your newly minted NFT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Image
                src={result.imageUrl}
                alt={result.metadata.name}
                width={150}
                height={150}
              />
            </div>
            {/* <p>
              <strong>Description:</strong> {result.metadata.description}
            </p> */}
          </CardContent>
          <CardFooter className="flex flex-row items-start justify-center space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={result.jsonUrl} target="_blank">
                View Metadata
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
              >
                View Transaction
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
