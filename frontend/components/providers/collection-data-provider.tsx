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
import { AccountInfo, PublicKey } from "@solana/web3.js";
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
  const prevDataRef = useRef<{ [key: string]: CollectionItem }>({});
  const metadataCache = useRef<{ [key: string]: any }>({});
  const uriCache = useRef<{ [key: string]: UriData }>({});

  const fetchItemMetadata = useCallback(
    async (mint: PublicKey) => {
      const mintString = mint.toBase58();
      let metadata = await getTokenMetadata(connection, mint);
      metadataCache.current[mintString] = metadata;
      return metadata;
    },
    [connection],
  );

  const fetchUriData = useCallback(async (uri: string, mintString: string) => {
    try {
      const response = await fetch(uri);
      if (response.ok) {
        const uriData = await response.json();
        uriCache.current[mintString] = uriData;
        return uriData;
      }
    } catch (error) {
      console.error(`Error fetching URI data for ${mintString}:`, error);
    }
    return null;
  }, []);

  const processItem = useCallback(
    async (item: any) => {
      const mintString = item.mint.toBase58();
      const prevItem = prevDataRef.current[mintString];
      let metadata = metadataCache.current[mintString];
      let uriData = uriCache.current[mintString];

      if (!prevItem || prevItem.points !== item.points || !metadata) {
        metadata = await fetchItemMetadata(new PublicKey(item.mint));
      }

      const newOverbid = Number(metadata?.additionalMetadata[0][1]) || 0;
      const newOwner = metadata?.additionalMetadata[1][1] || "Unknown";

      if (
        !prevItem ||
        prevItem.overbid !== newOverbid ||
        prevItem.owner !== newOwner ||
        !uriData
      ) {
        if (metadata?.uri && (!uriData || prevItem?.overbid !== newOverbid)) {
          uriData = await fetchUriData(metadata.uri, mintString);
        }
      }

      return {
        mint: item.mint,
        points: item.points,
        name: metadata?.name || "",
        image: uriData?.image || "",
        overbid: newOverbid,
        owner: newOwner,
      };
    },
    [fetchItemMetadata, fetchUriData],
  );

  const processAccountData = useCallback(
    async (accountData: CollectionAccount) => {
      try {
        const processedItems = await Promise.all(
          accountData.items.map(processItem),
        );

        const updatedData = Object.fromEntries(
          processedItems.map((item) => [item.mint.toBase58(), item]),
        );

        if (!isEqual(updatedData, prevDataRef.current)) {
          setAllData(Object.values(updatedData));
          prevDataRef.current = updatedData;
        }
        setError(null);
      } catch (error) {
        console.error("Error processing collection data:", error);
        setError("Failed to process collection data");
      } finally {
        setIsLoading(false);
      }
    },
    [processItem],
  );

  const handleAccountChange = useCallback(
    (accountInfo: AccountInfo<Buffer>) => {
      try {
        const decodedData = program.coder.accounts.decode(
          "collection",
          accountInfo.data,
        ) as CollectionAccount;
        processAccountData(decodedData);
      } catch (error) {
        console.error("Error decoding account data:", error);
        setError("Failed to decode account data");
      }
    },
    [processAccountData],
  );

  useEffect(() => {
    // Fetch initial account data
    program.account.collection.fetch(authority).then(processAccountData);

    // Subscribe to account changes
    const subscriptionId = connection.onAccountChange(
      authority,
      handleAccountChange,
    );

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, handleAccountChange, processAccountData]);

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
