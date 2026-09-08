export interface ConsistencyProvider<TData> {
  readonly id: string;
  get(): Promise<TData>;
}

export interface ProviderConsistencyResult<TData> {
  readonly consistent: boolean;
  readonly primaryProviderId: string;
  readonly secondaryProviderId: string;
  readonly primaryValue?: TData;
  readonly secondaryValue?: TData;
  readonly reason?: string;
}

export interface ProviderConsistencyOptions<TData> {
  readonly equals?: (left: TData, right: TData) => boolean;
}

export class ProviderConsistencyChecker<TData> {
  private readonly equals: (
    left: TData,
    right: TData,
  ) => boolean;

  constructor(options: ProviderConsistencyOptions<TData> = {}) {
    this.equals =
      options.equals ??
      ((left, right) => Object.is(left, right));
  }

  async check(
    primary: ConsistencyProvider<TData>,
    secondary: ConsistencyProvider<TData>,
  ): Promise<ProviderConsistencyResult<TData>> {
    if (primary.id.trim() === "") {
      throw new Error("Primary provider id is required");
    }

    if (secondary.id.trim() === "") {
      throw new Error("Secondary provider id is required");
    }

    if (primary.id === secondary.id) {
      throw new Error("Consistency providers must be different");
    }

    const [primaryValue, secondaryValue] = await Promise.all([
      primary.get(),
      secondary.get(),
    ]);

    if (this.equals(primaryValue, secondaryValue)) {
      return {
        consistent: true,
        primaryProviderId: primary.id,
        secondaryProviderId: secondary.id,
        primaryValue,
        secondaryValue,
      };
    }

    return {
      consistent: false,
      primaryProviderId: primary.id,
      secondaryProviderId: secondary.id,
      primaryValue,
      secondaryValue,
      reason: "Provider values do not match",
    };
  }
}