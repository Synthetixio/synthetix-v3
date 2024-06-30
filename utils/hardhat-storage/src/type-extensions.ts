declare module 'hardhat/types/config' {
  export interface HardhatUserConfig {
    storage?: {
      artifacts?: string[];
    };
  }

  export interface HardhatConfig {
    storage: {
      artifacts: string[];
    };
  }
}
