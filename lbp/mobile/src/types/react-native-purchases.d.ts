declare module "react-native-purchases" {
  export type PurchasesStoreProduct = {
    identifier: string;
    priceString: string;
  };

  const Purchases: {
    configure(options: { apiKey: string; appUserID: string }): void;
    logIn(appUserID: string): Promise<unknown>;
    logOut(): Promise<unknown>;
    getProducts(ids: string[]): Promise<PurchasesStoreProduct[]>;
    purchaseStoreProduct(product: PurchasesStoreProduct): Promise<unknown>;
  };

  export default Purchases;
}
