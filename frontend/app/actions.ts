"use server";

export async function fetchAllItems() {
  const response = await fetch("https://maplestory.io/api/GMS/247/item");
  return response.json();
}
