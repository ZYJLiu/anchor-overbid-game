"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { program } from "@/anchor/setup";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  CollectionItem,
  useCollection,
} from "@/components/providers/collection-data-provider";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface SelectedItem {
  mint: string;
  owner: string;
  overbid: number;
}

interface SortSelectProps {
  value: SortOption;
  onValueChange: (value: SortOption) => void;
}

type SortOption = "overbidHigh" | "overbidLow" | "pointsHigh" | "pointsLow";
type Mode = "bid" | "redeem";

export default function BidRedeemPage() {
  const { connection } = useConnection();
  const { publicKey, connected, signAllTransactions, signTransaction } =
    useWallet();
  const { getSortedAndFilteredData, isLoading, error } = useCollection();
  const [includeOwned, setIncludeOwned] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("overbidHigh");
  const [mode, setMode] = useState<Mode>("bid");
  const [selectedImages, setSelectedImages] = useState<
    Map<string, SelectedItem>
  >(new Map());

  const getData = useCallback(() => {
    if (mode === "redeem") {
      return getSortedAndFilteredData(includeOwned, sortOption, true);
    } else {
      return getSortedAndFilteredData(includeOwned, sortOption);
    }
  }, [mode, includeOwned, sortOption, getSortedAndFilteredData]);

  const processedData = getData();

  async function handleAction() {
    if (!publicKey || !signAllTransactions) {
      console.error("Wallet not connected");
      return;
    }

    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      const transactions: VersionedTransaction[] = [];
      let currentInstructions: TransactionInstruction[] = [];
      let instructionCount = 0;

      for (const item of selectedImages.values()) {
        const instruction = await (
          mode === "bid"
            ? program.methods
                .bid(new BN(Number(item.overbid) + 10_000_000))
                .accounts({
                  payer: publicKey,
                  owner: new PublicKey(item.owner),
                  mintAccount: item.mint,
                })
            : program.methods.redeem().accounts({
                owner: publicKey,
                mintAccount: item.mint,
              })
        ).instruction();

        currentInstructions.push(instruction);
        instructionCount++;

        if (instructionCount === 4) {
          const messageV0 = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: blockhash,
            instructions: currentInstructions,
          }).compileToV0Message();

          const transaction = new VersionedTransaction(messageV0);
          transactions.push(transaction);

          currentInstructions = [];
          instructionCount = 0;
        }
      }

      if (instructionCount > 0) {
        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: currentInstructions,
        }).compileToV0Message();

        const transaction = new VersionedTransaction(messageV0);
        transactions.push(transaction);
      }

      console.log(`Created ${transactions.length} transactions`);

      const signedTransactions = await signAllTransactions(transactions);

      const transactionPromises = signedTransactions.map(
        async (signedTransaction) => {
          try {
            const transactionSignature = await connection.sendTransaction(
              signedTransaction,
              {
                skipPreflight: true,
              },
            );
            console.log(`Transaction sent: ${transactionSignature}`);

            const confirmation = await connection.confirmTransaction({
              signature: transactionSignature,
              lastValidBlockHeight,
              blockhash,
            });

            if (confirmation.value.err) {
              throw new Error(
                `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
              );
            }

            console.log(`Transaction confirmed: ${transactionSignature}`);
          } catch (error) {
            console.error(`Error sending/confirming transaction: ${error}`);
          }
        },
      );

      await Promise.all(transactionPromises);

      console.log("All transactions processed");
      setSelectedImages(new Map());
    } catch (error) {
      console.error(
        `Error in handle${mode === "bid" ? "Bid" : "Redeem"}:`,
        error,
      );
    }
  }

  const toggleSelection = (item: SelectedItem) => {
    setSelectedImages((prevSelected) => {
      const newSelected = new Map(prevSelected);
      if (newSelected.has(item.mint)) {
        newSelected.delete(item.mint);
      } else {
        newSelected.set(item.mint, item);
      }
      return newSelected;
    });
  };

  const toggleMode = useCallback(() => {
    setMode((prevMode) => (prevMode === "bid" ? "redeem" : "bid"));
    setSelectedImages(new Map());
  }, []);

  async function handleBid(item: CollectionItem, bidAmount: number) {
    if (!publicKey || !signTransaction) {
      console.error("Wallet not connected");
      return;
    }

    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      const amount = bidAmount * LAMPORTS_PER_SOL;
      const instruction = await program.methods
        .bid(new BN(amount))
        .accounts({
          payer: publicKey,
          owner: new PublicKey(item.owner),
          mintAccount: item.mint,
        })
        .instruction();

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      const signedTransaction = await signTransaction(transaction);

      const signature = await connection.sendTransaction(signedTransaction, {
        skipPreflight: true,
      });
      console.log(`Transaction sent: ${signature}`);

      const confirmation = await connection.confirmTransaction({
        signature,
        lastValidBlockHeight,
        blockhash,
      });

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      console.log(`Transaction confirmed: ${signature}`);
    } catch (error) {
      console.error("Error in handleBid:", error);
    }
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="mx-3 my-5 mb-14 flex flex-col items-center justify-center">
      <div className="mb-3 flex items-center space-x-4">
        <Button
          variant="outline"
          onClick={handleAction}
          disabled={selectedImages.size === 0}
        >
          {mode === "bid" ? "Bid" : "Redeem"} ({selectedImages.size})
        </Button>
        <SortSelect value={sortOption} onValueChange={setSortOption} />
        <Button variant="outline" onClick={toggleMode}>
          {mode === "bid" ? "Switch to Redeem" : "Switch to Bid"}
        </Button>
        {/* {mode === "bid" && (
          <>
            <Button
              variant="outline"
              onClick={() => setIncludeOwned(!includeOwned)}
            >
              {includeOwned ? "Hide Owned" : "Show All"}
            </Button>
          </>
        )} */}
      </div>
      {(mode === "bid" || (mode === "redeem" && connected)) && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {processedData.map((item, index) => (
            <BidItemCard
              key={item.mint.toString()}
              item={item}
              isSelected={selectedImages.has(item.mint.toString())}
              onSelect={toggleSelection}
              onBid={handleBid}
              mode={mode}
              isPriority={index < 10}
            />
          ))}
        </div>
      )}
      {mode === "redeem" && !connected && (
        <div className="text-center text-lg">
          Please connect your wallet to view owned items.
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 flex justify-center space-x-2 pb-4">
        <Button
          variant="outline"
          onClick={handleAction}
          disabled={selectedImages.size === 0}
        >
          {mode === "bid" ? "Bid" : "Redeem"} ({selectedImages.size})
        </Button>
      </div>
    </div>
  );
}

function SortSelect({ value, onValueChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[210px]">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {/* <SelectItem value="none">No Sorting</SelectItem> */}
        <SelectItem value="overbidHigh">Highest Bid (Descending)</SelectItem>
        <SelectItem value="overbidLow">Highest Bid (Ascending)</SelectItem>
        <SelectItem value="pointsHigh">Points (Descending)</SelectItem>
        <SelectItem value="pointsLow">Points (Ascending)</SelectItem>
      </SelectContent>
    </Select>
  );
}

interface BidItemCardProps {
  item: CollectionItem;
  isSelected: boolean;
  onSelect: (item: { mint: string; owner: string; overbid: number }) => void;
  onBid: (item: CollectionItem, bidAmount: number) => Promise<void>;
  mode: Mode;
  isPriority: boolean;
}

function BidItemCard({
  item,
  isSelected,
  onSelect,
  onBid,
  mode,
  isPriority,
}: BidItemCardProps) {
  const minBidAmount = (Number(item.overbid) + 10000000) / LAMPORTS_PER_SOL;

  const formSchema = z.object({
    bidAmount: z
      .number()
      .min(minBidAmount, `Bid must be at least ${minBidAmount.toFixed(4)} SOL`),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bidAmount: minBidAmount,
    },
  });

  const handleCardClick = (e: any) => {
    if (!e.target.closest("form") && !e.target.closest("button")) {
      onSelect({
        mint: item.mint.toString(),
        owner: item.owner,
        overbid: item.overbid,
      });
    }
  };

  return (
    <div
      className="relative w-72 cursor-pointer p-2 transition-transform duration-200 ease-in-out hover:scale-105"
      onClick={handleCardClick}
    >
      <div
        className={`overflow-hidden rounded-lg border-2 ${
          isSelected ? "border-white" : "hover:border-gray-600"
        }`}
      >
        <div className="relative aspect-square w-full">
          <Image
            alt={item.name}
            src={item.image || "/placeholder-image.png"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 256px, (max-width: 1024px) 288px, (max-width: 1280px) 320px, 384px"
            style={{
              objectFit: "cover",
            }}
            priority={isPriority}
          />
        </div>
        <div className="bg-black bg-opacity-50 p-2 text-white">
          <p className="truncate font-bold">{item.name}</p>
          <p className="text-sm">
            {(Number(item.overbid) / LAMPORTS_PER_SOL).toFixed(4)} Highest SOL
            Bid
          </p>
          <p className="text-sm">
            {(item.points / LAMPORTS_PER_SOL).toFixed(4)} SOL Redeemable
          </p>
          <p className="text-sm">
            Owner: {`${item.owner.slice(0, 4)}...${item.owner.slice(-4)}`}
          </p>
        </div>
        {mode === "bid" && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                onBid(item, data.bidAmount),
              )}
              className="flex items-center p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <FormField
                control={form.control}
                name="bidAmount"
                render={({ field }) => (
                  <FormItem className="mr-2 flex-grow">
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={minBidAmount}
                        placeholder={`Min Bid: ${minBidAmount.toFixed(4)} SOL`}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" variant="outline" size="sm">
                Bid
              </Button>
            </form>
          </Form>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="absolute right-4 top-4"
        onClick={(e) => {
          e.stopPropagation();
          onSelect({
            mint: item.mint.toString(),
            owner: item.owner,
            overbid: item.overbid,
          });
        }}
      >
        {isSelected ? "Deselect" : "Select"}
      </Button>
    </div>
  );
}
