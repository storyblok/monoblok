import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import {
  type BridgeParams,
  type SbBlokData,
  LivePreviewService,
  Story,
  StoryblokComponent,
  StoryblokService,
} from "@storyblok/angular";

const BROKER_QA_STORAGE_KEY = "storyblok-live-preview-qa";

type BrokerQaScenario =
  | "singleA"
  | "singleB"
  | "sameTick"
  | "sequential"
  | "reverseSequential"
  | "delayed";

type BrokerQaApi = {
  run: (scenario: BrokerQaScenario) => Promise<void>;
  clear: () => void;
  clearA: () => void;
  clearB: () => void;
  state: () => { active: string[]; updatesA: number; updatesB: number };
};

declare global {
  interface Window {
    __storyblokBrokerQa?: BrokerQaApi;
  }
}

@Component({
  selector: "app-live-preview-qa",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      @if (isBrokerQaMode()) {
        <section class="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h1 class="mb-3 text-lg font-semibold text-blue-900">Live Preview Broker QA</h1>
          <div class="mb-3 flex flex-wrap gap-2">
            @for (scenario of scenarios; track scenario.value) {
              <button
                class="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                type="button"
                (click)="runScenarioFromUi(scenario.value)"
              >
                {{ scenario.label }}
              </button>
            }
          </div>
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              class="rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              type="button"
              (click)="clearSubscriptions()"
            >
              Clear all
            </button>
            <button
              class="rounded bg-slate-500 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
              type="button"
              (click)="clearSubscriber('A')"
            >
              Clear A
            </button>
            <button
              class="rounded bg-slate-500 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
              type="button"
              (click)="clearSubscriber('B')"
            >
              Clear B
            </button>
          </div>
          <p class="text-sm text-blue-900">
            Active: {{ activeSubscribers() || "none" }} | Updates A: {{ updatesA() }} | Updates B:
            {{ updatesB() }}
          </p>
          @if (scenarioError()) {
            <p class="mt-2 text-sm text-red-700">{{ scenarioError() }}</p>
          }
        </section>
      }
      <sb-component [sbBlok]="storyContent()" />
      @if (loading()) {
        <p class="text-slate-500">Loading...</p>
      } @else if (!storyContent()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 class="text-yellow-800 text-xl font-semibold mb-2">No content found</h2>
          <p class="text-yellow-600">No story found for slug: angular/live-preview-qa</p>
        </div>
      }
    </div>
  `,
})
export class LivePreviewQaComponent implements OnInit {
  private readonly storyblok = inject(StoryblokService);
  private readonly livePreview = inject(LivePreviewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly client = this.storyblok.getClient();

  readonly story = signal<Story | null>(null);
  readonly loading = signal(true);
  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);
  readonly updatesA = signal(0);
  readonly updatesB = signal(0);
  readonly scenarioError = signal<string | null>(null);

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
    if (this.isBrokerQaMode()) {
      this.installBrokerQaApi();
      return;
    }

    afterNextRender(() => {
      this.livePreview.connect(
        (updatedStory) => this.story.set((updatedStory as Story) || null),
        this.destroyRef,
        {
          resolveRelations: ["featured-articles.articles", "article.author"],
          preventClicks: false,
        },
      );
    });
  }

  ngOnInit(): void {
    try {
      this.destroyRef.onDestroy(() => this.clearSubscriptions());
    } catch {
      return;
    }

    void this.loadStory();
  }

  private async loadStory(): Promise<void> {
    try {
      const { data } = await this.client.stories.get("angular/live-preview-qa", {
        query: {
          version: "draft",
          resolve_relations: "featured-articles.articles,article.author",
        },
      });
      this.story.set((data?.story as Story) || null);
    } finally {
      this.loading.set(false);
    }
  }

  protected isBrokerQaMode(): boolean {
    return (
      typeof window !== "undefined" && window.localStorage.getItem(BROKER_QA_STORAGE_KEY) === "true"
    );
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
    try {
      this.destroyRef.onDestroy(() => {
        api.clear();
        if (window.__storyblokBrokerQa === api) delete window.__storyblokBrokerQa;
      });
    } catch {
      api.clear();
      if (window.__storyblokBrokerQa === api) delete window.__storyblokBrokerQa;
    }
  }

  private async runScenario(scenario: BrokerQaScenario): Promise<void> {
    this.scenarioError.set(null);
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
        await this.subscribeB();
        return;
      case "reverseSequential":
        await this.subscribeB();
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
    try {
      await this.runScenario(scenario);
    } catch (error) {
      this.scenarioError.set(error instanceof Error ? error.message : String(error));
    }
  }

  activeSubscribers(): string {
    return [this.cleanupA && "A", this.cleanupB && "B"]
      .filter((subscriber): subscriber is string => Boolean(subscriber))
      .join(", ");
  }

  clearSubscriptions(): void {
    this.scenarioVersion += 1;
    if (this.delayedSubscription) {
      clearTimeout(this.delayedSubscription);
      this.delayedSubscription = undefined;
    }

    this.cleanupA?.();
    this.cleanupB?.();
    this.cleanupA = undefined;
    this.cleanupB = undefined;
  }

  clearSubscriber(subscriber: "A" | "B"): void {
    if (subscriber === "A") {
      this.cleanupA?.();
      this.cleanupA = undefined;
    } else {
      this.cleanupB?.();
      this.cleanupB = undefined;
    }
  }

  private async subscribeA(): Promise<void> {
    this.cleanupA = await this.livePreview.listen((updatedStory) => {
      this.story.set(updatedStory as Story);
      this.updatesA.update((count) => count + 1);
    }, this.subscriberAOptions);
  }

  private async subscribeB(): Promise<void> {
    this.cleanupB = await this.livePreview.listen((updatedStory) => {
      this.story.set(updatedStory as Story);
      this.updatesB.update((count) => count + 1);
    }, this.subscriberBOptions);
  }
}
