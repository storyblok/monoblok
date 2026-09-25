import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
} from "@angular/core";
import {
  type BridgeParams,
  type SbBlokData,
  LivePreviewService,
  type Story,
  StoryblokComponent,
} from "@storyblok/angular";

type BrokerQaScenario =
  | "singleA"
  | "singleB"
  | "sameTick"
  | "sequential"
  | "reverseSequential"
  | "delayed";

type BrokerQaState = { active: string[]; updatesA: number; updatesB: number };
type BrokerQaApi = {
  run: (scenario: BrokerQaScenario) => Promise<void>;
  clear: () => void;
  clearA: () => void;
  clearB: () => void;
  state: () => BrokerQaState;
};

declare global {
  interface Window {
    __storyblokBrokerQa?: BrokerQaApi;
  }
}

const QA_STORAGE_KEY = "storyblok-live-preview-qa";

@Component({
  selector: "app-live-preview",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    <main class="p-8 max-w-7xl mx-auto">
      <span data-testid="angular-qa-story" hidden>{{ story()?.name }}</span>
      @if (isQaMode()) {
        <section class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h1 class="mb-3 text-lg font-semibold text-blue-900">Live Preview Broker QA</h1>
          <div class="mb-3 flex flex-wrap gap-2">
            @for (scenario of scenarios; track scenario.value) {
              <button type="button" (click)="runScenarioFromUi(scenario.value)">
                {{ scenario.label }}
              </button>
            }
          </div>
          <div class="mb-3 flex flex-wrap gap-2">
            <button type="button" (click)="clearSubscriptions()">Clear all</button>
            <button type="button" (click)="clearSubscriber('A')">Clear A</button>
            <button type="button" (click)="clearSubscriber('B')">Clear B</button>
          </div>
          <p>
            Active: {{ activeSubscribers() || "none" }} | Updates A: {{ updatesA() }} | Updates B:
            {{ updatesB() }}
          </p>
        </section>
      }
      <sb-component [sbBlok]="storyContent()" />
      @if (!storyContent()) {
        <p>No content found</p>
      }
    </main>
  `,
})
export class LivePreviewComponent {
  private readonly livePreview = inject(LivePreviewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly storyInput = input<Story | null>(null, { alias: "story" });
  readonly story = linkedSignal(() => this.storyInput());
  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);
  readonly updatesA = signal(0);
  readonly updatesB = signal(0);
  readonly scenarios = [
    { value: "singleA", label: "Single A" },
    { value: "singleB", label: "Single B" },
    { value: "sameTick", label: "Same tick A+B" },
    { value: "sequential", label: "A then B" },
    { value: "reverseSequential", label: "B then A" },
    { value: "delayed", label: "A then B after 3s" },
  ] as const;

  private cleanupA?: () => void;
  private cleanupB?: () => void;
  private delayedSubscription?: ReturnType<typeof setTimeout>;
  private scenarioVersion = 0;
  private readonly subscriberAOptions: BridgeParams = {
    resolveRelations: ["featured-articles.articles"],
    preventClicks: false,
  };
  private readonly subscriberBOptions: BridgeParams = {
    resolveRelations: ["article.author"],
    preventClicks: false,
  };

  constructor() {
    if (this.isQaMode()) {
      this.installBrokerQaApi();
      return;
    }

    afterNextRender(() => {
      void this.livePreview
        .connect((updatedStory) => this.story.set(updatedStory as Story), this.destroyRef, {
          resolveRelations: ["article.author"],
          preventClicks: false,
        })
        .catch((error: unknown) =>
          console.error("[Storyblok] Live preview connection failed:", error),
        );
    });
  }

  isQaMode(): boolean {
    return typeof window !== "undefined" && window.localStorage.getItem(QA_STORAGE_KEY) === "true";
  }

  private installBrokerQaApi(): void {
    const api: BrokerQaApi = {
      run: (scenario) => this.runScenario(scenario),
      clear: () => this.clearSubscriptions(),
      clearA: () => this.clearSubscriber("A"),
      clearB: () => this.clearSubscriber("B"),
      state: () => ({
        active: [this.cleanupA && "A", this.cleanupB && "B"].filter(
          (subscriber): subscriber is string => Boolean(subscriber),
        ),
        updatesA: this.updatesA(),
        updatesB: this.updatesB(),
      }),
    };

    window.__storyblokBrokerQa = api;
    this.destroyRef.onDestroy(() => {
      api.clear();
      if (window.__storyblokBrokerQa === api) delete window.__storyblokBrokerQa;
    });
  }

  private async runScenario(scenario: BrokerQaScenario): Promise<void> {
    this.clearSubscriptions();
    const scenarioVersion = this.scenarioVersion;
    switch (scenario) {
      case "singleA":
        await this.subscribeA();
        return;
      case "singleB":
        await this.subscribeB();
        return;
      case "sameTick":
        await Promise.all([this.subscribeA(), this.subscribeB()]);
        return;
      case "sequential":
        await this.subscribeA();
        if (scenarioVersion !== this.scenarioVersion) return;
        await this.subscribeB();
        return;
      case "reverseSequential":
        await this.subscribeB();
        if (scenarioVersion !== this.scenarioVersion) return;
        await this.subscribeA();
        return;
      case "delayed":
        await this.subscribeA();
        await new Promise<void>((resolve) => {
          this.delayedSubscription = setTimeout(() => {
            this.delayedSubscription = undefined;
            resolve();
          }, 3000);
        });
        if (scenarioVersion !== this.scenarioVersion) return;
        await this.subscribeB();
        return;
    }
  }

  async runScenarioFromUi(scenario: BrokerQaScenario): Promise<void> {
    await this.runScenario(scenario);
  }

  activeSubscribers(): string {
    return [this.cleanupA && "A", this.cleanupB && "B"]
      .filter((subscriber): subscriber is string => Boolean(subscriber))
      .join(", ");
  }

  clearSubscriptions(): void {
    this.scenarioVersion += 1;
    if (this.delayedSubscription) clearTimeout(this.delayedSubscription);
    this.delayedSubscription = undefined;
    this.cleanupA?.();
    this.cleanupB?.();
    this.cleanupA = undefined;
    this.cleanupB = undefined;
  }

  clearSubscriber(subscriber: "A" | "B"): void {
    this.scenarioVersion += 1;
    if (subscriber === "A") {
      this.cleanupA?.();
      this.cleanupA = undefined;
    } else {
      this.cleanupB?.();
      this.cleanupB = undefined;
    }
  }

  private async subscribeA(): Promise<void> {
    const version = this.scenarioVersion;
    const cleanup = await this.livePreview.listen((story) => {
      this.story.set(story as Story);
      this.updatesA.update((count) => count + 1);
    }, this.subscriberAOptions);
    if (version !== this.scenarioVersion) {
      cleanup();
      return;
    }
    this.cleanupA = cleanup;
  }

  private async subscribeB(): Promise<void> {
    const version = this.scenarioVersion;
    const cleanup = await this.livePreview.listen((story) => {
      this.story.set(story as Story);
      this.updatesB.update((count) => count + 1);
    }, this.subscriberBOptions);
    if (version !== this.scenarioVersion) {
      cleanup();
      return;
    }
    this.cleanupB = cleanup;
  }
}
