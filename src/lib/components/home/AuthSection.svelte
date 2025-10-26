<script lang="ts">
  let showSignIn = $state(false);
  let showSignUp = $state(false);
  
  // Form states
  let signInForm = $state({
    email: '',
    password: ''
  });
  
  let signUpForm = $state({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  function toggleSignIn() {
    showSignIn = !showSignIn;
    showSignUp = false;
  }
  
  function toggleSignUp() {
    showSignUp = !showSignUp;
    showSignIn = false;
  }
  
  function handleSignIn(e: Event) {
    e.preventDefault();
    console.log('Sign in:', signInForm);
    // TODO: Implement sign in logic
  }
  
  function handleSignUp(e: Event) {
    e.preventDefault();
    console.log('Sign up:', signUpForm);
    // TODO: Implement sign up logic
  }

  // Export functions for external use
  export function openSignIn() {
    showSignIn = true;
    showSignUp = false;
  }

  export function openSignUp() {
    showSignUp = true;
    showSignIn = false;
  }
</script>

<section class="mb-16">
  <div class="text-center mb-8">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
      Join the Community
    </h2>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      Sign up to share your videos, discover new content, and connect with creators
    </p>
    
    <!-- Auth Toggle Buttons -->
    <div class="flex items-center justify-center gap-4">
      <button 
        onclick={toggleSignUp}
        class="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
      >
        Create Account
      </button>
      <button 
        onclick={toggleSignIn}
        class="rounded-full border border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        Sign In
      </button>
    </div>
  </div>

  <!-- Sign Up Form -->
  {#if showSignUp}
    <div class="mx-auto max-w-md">
      <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Your Account</h3>
        <form onsubmit={handleSignUp} class="space-y-4">
          <div>
            <label for="signup-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              bind:value={signUpForm.name}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your full name"
            />
          </div>
          
          <div>
            <label for="signup-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="signup-email"
              type="email"
              bind:value={signUpForm.email}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <label for="signup-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              bind:value={signUpForm.password}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Create a password"
            />
          </div>
          
          <div>
            <label for="signup-confirm" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="signup-confirm"
              type="password"
              bind:value={signUpForm.confirmPassword}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Confirm your password"
            />
          </div>
          
          <button
            type="submit"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Create Account
          </button>
        </form>
        
        <button 
          onclick={() => showSignUp = false}
          class="mt-4 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Sign In Form -->
  {#if showSignIn}
    <div class="mx-auto max-w-md">
      <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Welcome Back</h3>
        <form onsubmit={handleSignIn} class="space-y-4">
          <div>
            <label for="signin-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="signin-email"
              type="email"
              bind:value={signInForm.email}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>
          
          <div>
            <label for="signin-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              bind:value={signInForm.password}
              required
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Sign In
          </button>
        </form>
        
        <div class="mt-4 text-center">
          <button class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
            Forgot your password?
          </button>
        </div>
        
        <button 
          onclick={() => showSignIn = false}
          class="mt-4 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</section>
