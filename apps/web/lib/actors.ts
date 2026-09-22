export const actors = {
  buyer: {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Amara Okafor",
    label: "Buyer",
  },
  seller: {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Tunde Adebayo",
    label: "Seller",
  },
  advisor: {
    id: "10000000-0000-0000-0000-000000000003",
    name: "Nia Mensah",
    label: "Deal advisor",
  },
} as const;

export type DemoRole = keyof typeof actors;

export function roleFrom(value?: string): DemoRole {
  return value === "seller" || value === "advisor" ? value : "buyer";
}
