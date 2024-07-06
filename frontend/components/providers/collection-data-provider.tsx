"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getTokenMetadata } from "@solana/spl-token";
import { program, authority, CollectionAccount } from "@/anchor/setup";
import isEqual from "lodash/isEqual";

export interface CollectionItem {
  mint: PublicKey;
  points: number;
  name: string;
  image: string;
  overbid: number;
  owner: string;
}

interface UriData {
  name?: string;
  image?: string;
}

interface CollectionContextType {
  allData: CollectionItem[];
  isLoading: boolean;
  error: string | null;
  getSortedAndFilteredData: (
    includeOwned: boolean,
    sortOption: SortOption,
    onlyOwned?: boolean,
  ) => CollectionItem[];

  //   getSortedAndFilteredData: (
  //     includeOwned: boolean,
  //     sortOption: SortOption,
  //     onlyOwned: boolean,
  //     page: number,
  //     pageSize: number,
  //   ) => { items: CollectionItem[]; totalItems: number };
}

type SortOption =
  | "overbidHigh"
  | "overbidLow"
  | "pointsHigh"
  | "pointsLow"
  | "none";

const CollectionContext = createContext<CollectionContextType | undefined>(
  undefined,
);

export function useCollection() {
  const context = useContext(CollectionContext);
  if (context === undefined) {
    throw new Error("useCollection must be used within a CollectionProvider");
  }
  return context;
}

export function CollectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [allData, setAllData] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<CollectionItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const data: CollectionAccount =
        await program.account.collection.fetch(authority);

      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const mint = new PublicKey(item.mint);
          const metadata = await getTokenMetadata(connection, mint);
          let uriData: UriData = {};
          if (metadata?.uri) {
            try {
              const response = await fetch(metadata.uri);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              uriData = await response.json();
            } catch (error) {
              console.error(`Error fetching URI data for ${item.mint}:`, error);
            }
          }

          return {
            mint: item.mint,
            points: item.points,
            name: uriData.name || "",
            image: uriData.image || "",
            overbid: Number(metadata?.additionalMetadata[0][1]) || 0,
            owner: metadata?.additionalMetadata[1][1] || "Unknown",
          };
        }),
      );

      if (!isEqual(processedItems, prevDataRef.current)) {
        setAllData(processedItems);
        prevDataRef.current = processedItems;
      }
      setError(null);
    } catch (error) {
      console.error("Error processing collection data:", error);
      setError("Failed to fetch collection data, probably rate limited by rpc");
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchData();
    const subscriptionId = connection.onAccountChange(authority, fetchData);
    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, fetchData]);

  //   const getSortedAndFilteredData = useCallback(
  //     (
  //       includeOwned: boolean,
  //       sortOption: SortOption,
  //       onlyOwned: boolean = false,
  //       page: number = 1,
  //       pageSize: number = 10,
  //     ) => {
  //       let filteredData = allData;

  //       if (connected && publicKey) {
  //         if (onlyOwned) {
  //           filteredData = allData.filter(
  //             (item) => item.owner === publicKey.toBase58(),
  //           );
  //         } else if (!includeOwned) {
  //           filteredData = allData.filter(
  //             (item) => item.owner !== publicKey.toBase58(),
  //           );
  //         }
  //       }

  //       let sortedData = [...filteredData];
  //       switch (sortOption) {
  //         case "overbidHigh":
  //           sortedData.sort((a, b) => b.overbid - a.overbid);
  //           break;
  //         case "overbidLow":
  //           sortedData.sort((a, b) => a.overbid - b.overbid);
  //           break;
  //         case "pointsHigh":
  //           sortedData.sort((a, b) => b.points - a.points);
  //           break;
  //         case "pointsLow":
  //           sortedData.sort((a, b) => a.points - b.points);
  //           break;
  //       }

  //       const startIndex = (page - 1) * pageSize;
  //       const endIndex = Math.min(startIndex + pageSize, sortedData.length);
  //       const paginatedData = sortedData.slice(startIndex, endIndex);

  //       return {
  //         items: paginatedData,
  //         totalItems: sortedData.length,
  //       };
  //     },
  //     [allData, connected, publicKey],
  //   );

  const getSortedAndFilteredData = useCallback(
    (
      includeOwned: boolean,
      sortOption: SortOption,
      onlyOwned: boolean = false,
    ) => {
      let filteredData = allData;

      if (connected && publicKey) {
        if (onlyOwned) {
          filteredData = allData.filter(
            (item) => item.owner === publicKey.toBase58(),
          );
        } else if (!includeOwned) {
          filteredData = allData.filter(
            (item) => item.owner !== publicKey.toBase58(),
          );
        }
      }

      switch (sortOption) {
        case "overbidHigh":
          return filteredData.sort((a, b) => b.overbid - a.overbid);
        case "overbidLow":
          return filteredData.sort((a, b) => a.overbid - b.overbid);
        case "pointsHigh":
          return filteredData.sort((a, b) => b.points - a.points);
        case "pointsLow":
          return filteredData.sort((a, b) => a.points - b.points);
        default:
          return filteredData;
      }
    },
    [allData, connected, publicKey],
  );

  return (
    <CollectionContext.Provider
      value={{
        allData,
        isLoading,
        error,
        getSortedAndFilteredData,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
}
