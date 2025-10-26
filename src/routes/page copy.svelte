<script lang="ts">
  import StatsSection from '$lib/components/home/StatsSection.svelte';
  import GeneratedChannels from '$lib/components/home/GeneratedChannels.svelte';
</script>

<svelte:head>
  <title>rushes.fm - Global Video Archive</title>
  <meta name="description" content="A platform for finding and sharing unedited footage from users around the world. Discover connections through AI-powered content analysis." />
</svelte:head>

<div class="min-h-screen bg-white dark:bg-black">
  <!-- Minimal Header -->
  <header class="border-b border-gray-100 dark:border-gray-900 bg-white/60 dark:bg-black/60 backdrop-blur-sm sticky top-0 z-10">
    <div class="mx-auto max-w-4xl px-6 py-3">
      <div class="flex items-center justify-between">
        <!-- Logo -->
        <a href="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div class="h-5 w-5 rounded bg-blue-600"></div>
          <span class="text-base font-medium text-gray-900 dark:text-white">rushes.fm</span>
        </a>

        <!-- Navigation -->
        <nav class="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <a href="/videos" class="hover:text-gray-900 dark:hover:text-white transition-colors">Browse</a>
          <a href="/keywords" class="hover:text-gray-900 dark:hover:text-white transition-colors">Keywords</a>
          <a href="/map" class="hover:text-gray-900 dark:hover:text-white transition-colors">Map</a>
          <a href="/about" class="hover:text-gray-900 dark:hover:text-white transition-colors">About</a>
        </nav>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="mx-auto max-w-5xl px-6 py-12">
    <!-- Hero Section -->
    <div class="text-center mb-16">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-6">
        rushes.fm
      </h1>
      <div class="max-w-3xl mx-auto">
        <p class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
          rushes.fm is a platform for finding and sharing unedited footage from users around the world.
          Vector embeddings allow the platform to find connections between clips based on the content of the footage,
          as well as metadata such as keywords, transcriptions and location information.
          Each week the platform generates a new channel based on the content uploaded from the prior seven days.
        </p>

        <!-- Action Buttons -->
        <div class="flex items-center justify-center gap-4 mb-12">
          <a
            href="/videos"
            class="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Browse Archive
          </a>
          <a
            href="/keywords"
            class="rounded-full border border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Explore Keywords
          </a>
        </div>
      </div>
    </div>

    <!-- Generated Channels -->
    <GeneratedChannels />

    <!-- Account Creation CTA -->
    <div class="rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 p-8 mb-16">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Unlock the Full Archive Experience
        </h2>
        <p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Create an account to access advanced features, contribute your footage, and build your personal video vault
        </p>
      </div>

      <!-- Benefits Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Upload & Archive</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Upload your unedited footage to the global archive</p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Auto-Transcription</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Automatic speech-to-text for searchable content</p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Rich Metadata</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Location, keywords, and content analysis</p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Natural Language Search</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Search using everyday language and concepts</p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Create Channels</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Curate and subscribe to themed collections</p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 dark:text-white text-sm">Personal Vault Export</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Download your data for local LLM RAG systems</p>
          </div>
        </div>
      </div>

      <!-- CTA Buttons -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button class="w-full sm:w-auto rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg">
          Create Free Account
        </button>
        <button class="w-full sm:w-auto rounded-full border border-gray-300 dark:border-gray-600 px-8 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Learn More
        </button>
      </div>

      <!-- Trust Indicators -->
      <div class="mt-6 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Free account • No credit card required • Export your data anytime
        </p>
      </div>
    </div>
<!--  -->
  </main>

  <!-- Stats at Bottom -->
  <StatsSection />
</div>
