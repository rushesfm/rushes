<script lang="ts">
  // Mock platform statistics
  const stats = [
    {
      name: 'Total Videos',
      value: '12,847',
      change: '+12%',
      changeType: 'increase',
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
    },
    {
      name: 'Active Creators',
      value: '2,341',
      change: '+8%',
      changeType: 'increase',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    },
    {
      name: 'Hours Watched',
      value: '847K',
      change: '+23%',
      changeType: 'increase',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      name: 'Community Members',
      value: '89,432',
      change: '+15%',
      changeType: 'increase',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    }
  ];
</script>

<section class="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-12">
  <div class="mx-auto max-w-4xl px-6">
    <div class="grid grid-cols-2 gap-8 lg:grid-cols-4">
      {#each stats as stat}
        <div class="text-center">
          <!-- Value -->
          <div class="text-2xl font-bold text-gray-900 dark:text-white">
            {stat.value}
          </div>
          <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {stat.name}
          </div>
        </div>
      {/each}
    </div>

    <!-- Footer -->
    <div class="mt-8 text-center">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        © 2024 Rushes. A community for video creators and enthusiasts.
      </p>
    </div>
  </div>
</section>
