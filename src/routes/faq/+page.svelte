<script lang="ts">
    let openSections = $state<Set<string>>(new Set());
    
    function toggleSection(id: string) {
        if (openSections.has(id)) {
            openSections.delete(id);
        } else {
            openSections.add(id);
        }
        openSections = new Set(openSections);
    }
    
    const faqCategories = [
        {
            id: 'getting-started',
            title: 'Getting Started',
            questions: [
                {
                    id: 'what-is-rushes',
                    question: 'What is Rushes?',
                    answer: 'Rushes is a collective platform dedicated to filmmakers. It maps rushes — unedited footage, fragments from shoots — to create a living archive, a meeting space, and a visual experimentation laboratory. The platform allows users to find and share unedited footage, discover connections between clips using AI-powered content analysis, and explore content through keywords, locations, and dates.'
                },
                {
                    id: 'how-to-sign-up',
                    question: 'How do I create an account?',
                    answer: 'To create an account, visit the Account page and click "Create account". You\'ll need to provide a display name, email address, and password. If invite codes are enabled, you\'ll also need a valid invite code from your RUSHES contact. Once you sign up, you may need to confirm your email address before you can sign in.'
                },
                {
                    id: 'invite-code',
                    question: 'Do I need an invite code?',
                    answer: 'Invite codes may be required depending on your environment. If invite codes are enabled, you\'ll need to obtain one from your RUSHES contact to create an account. In some environments, invite codes are optional. Check the signup form on the Account page to see if an invite code is required.'
                },
                {
                    id: 'first-steps',
                    question: 'What should I do after signing up?',
                    answer: 'After signing up and confirming your account, you can start exploring the platform. Browse videos by keywords, dates, or users. Use the search feature to find specific content. If you\'re a filmmaker, you can upload your own rushes through the Upload page to contribute to the archive.'
                }
            ]
        },
        {
            id: 'uploading-content',
            title: 'Uploading Content',
            questions: [
                {
                    id: 'how-to-upload',
                    question: 'How do I upload videos?',
                    answer: 'To upload videos, navigate to the Upload page (accessible from the sidebar). You\'ll need to provide a title, optional description, and metadata such as keywords, location information, and transcript. The platform processes your upload and makes it discoverable through the various browsing and search features.'
                },
                {
                    id: 'what-to-upload',
                    question: 'What kind of content should I upload?',
                    answer: 'Rushes focuses on unedited footage — raw clips, fragments from shoots, and experimental visual content. Upload rushes that you want to share with the community. Make sure to add relevant keywords, location data, and other metadata to help others discover your content.'
                },
                {
                    id: 'video-requirements',
                    question: 'Are there requirements for video uploads?',
                    answer: 'Specific technical requirements may vary. Generally, you should upload videos in common formats and ensure they meet any size or duration limits. Check the Upload page for current specifications, and reach out to support if you encounter issues.'
                },
                {
                    id: 'metadata-importance',
                    question: 'Why is metadata important?',
                    answer: 'Metadata (keywords, location, transcripts, descriptions) helps make your content discoverable. The platform uses this information along with AI-powered content analysis to find connections between videos. The more accurate and detailed your metadata, the better others can find and connect with your content.'
                }
            ]
        },
        {
            id: 'browsing-content',
            title: 'Browsing & Discovery',
            questions: [
                {
                    id: 'browse-keywords',
                    question: 'How do I browse by keywords?',
                    answer: 'Visit the Browse page and select the "Keywords" tab. You\'ll see all available keywords organized alphabetically in a telephone book style. Click on any keyword to see all videos tagged with that keyword. Each video card displays the title, author, and description when you hover over it.'
                },
                {
                    id: 'browse-dates',
                    question: 'How do I browse by date?',
                    answer: 'On the Browse page, select the "Dates" tab to see videos organized hierarchically by year, month, and day. Click on a year, month, or specific day to view all videos from that time period. This makes it easy to explore content chronologically.'
                },
                {
                    id: 'browse-users',
                    question: 'How do I browse by users?',
                    answer: 'Select the "Users" tab on the Browse page to see all users organized alphabetically. Click on any user to visit their profile and see all videos they\'ve uploaded. You can also click on an author name from any video to navigate to their profile.'
                },
                {
                    id: 'search-feature',
                    question: 'How does the search feature work?',
                    answer: 'The search feature on the Browse page allows natural language search across video titles, descriptions, keywords, authors, and transcripts. Simply type your query and results will appear, prioritized by title matches and sorted by relevance. Search results show video cards with thumbnails and metadata.'
                },
                {
                    id: 'map-exploration',
                    question: 'How do I explore videos by location?',
                    answer: 'Use the Map page to explore videos geographically. Videos with location data are displayed on an interactive map. Click on markers or the map itself to discover content from specific locations. You can also click on location coordinates in video info panels to navigate to the map view.'
                }
            ]
        },
        {
            id: 'video-features',
            title: 'Video Features',
            questions: [
                {
                    id: 'video-player',
                    question: 'How do I watch videos?',
                    answer: 'Click on any video card or title to open the video player. The player supports HLS streaming and includes timeline controls, playback controls (previous, play/pause, next), and hover overlays with video information. The timeline component shows visual markers and can be used for navigation.'
                },
                {
                    id: 'video-info',
                    question: 'What information is shown about each video?',
                    answer: 'Each video displays its author, date of creation (with time and day/night indicator), summary/description, keywords (clickable links to keyword pages), location (with city/region name and interactive map), and transcript if available. Summary, keywords, and location are expanded by default for quick reference.'
                },
                {
                    id: 'video-navigation',
                    question: 'How do I navigate between videos?',
                    answer: 'Use the previous/next buttons in the video player controls to move between videos. You can also click on video cards from browse pages, search results, or user profiles. The selected video will load in the player automatically.'
                },
                {
                    id: 'keyword-links',
                    question: 'Can I click on keywords?',
                    answer: 'Yes! Keywords in video info panels are clickable links that take you to a page showing all videos with that keyword. This makes it easy to discover related content and explore themes across the archive.'
                }
            ]
        },
        {
            id: 'account-settings',
            title: 'Account & Settings',
            questions: [
                {
                    id: 'edit-profile',
                    question: 'How do I edit my profile?',
                    answer: 'Profile editing features may be available through your account settings. Currently, your profile displays your display name, email, and any associated metadata. Additional profile customization options may be added in future updates.'
                },
                {
                    id: 'sign-out',
                    question: 'How do I sign out?',
                    answer: 'To sign out, visit the Account page and click the "Sign out" button. You\'ll be logged out and redirected appropriately. You can sign back in at any time using your email and password.'
                },
                {
                    id: 'password-reset',
                    question: 'How do I reset my password?',
                    answer: 'Password reset functionality is typically handled through email. If you\'ve forgotten your password, contact support or use the account recovery options available on the login page. The exact process may vary depending on your authentication setup.'
                },
                {
                    id: 'data-privacy',
                    question: 'What happens to my data?',
                    answer: 'Your account data, including uploaded videos and metadata, is stored securely. The platform uses your videos and associated information to create connections and enable discovery features. For specific privacy concerns, please contact your RUSHES administrator.'
                }
            ]
        },
        {
            id: 'technical',
            title: 'Technical & Support',
            questions: [
                {
                    id: 'browser-support',
                    question: 'Which browsers are supported?',
                    answer: 'Rushes works best in modern browsers that support the latest web standards. The platform uses HLS video streaming, so ensure your browser supports this format. Chrome, Firefox, Safari, and Edge are generally well-supported.'
                },
                {
                    id: 'video-not-playing',
                    question: 'Why isn\'t my video playing?',
                    answer: 'Video playback issues can be caused by browser compatibility, network connectivity, or video format issues. Ensure you\'re using a supported browser and have a stable internet connection. If problems persist, try refreshing the page or contact support.'
                },
                {
                    id: 'performance-issues',
                    question: 'The site seems slow. What can I do?',
                    answer: 'Performance can be affected by network conditions, browser cache, or device capabilities. Try clearing your browser cache, closing unnecessary tabs, or using a faster internet connection. The platform is optimized for performance, but heavy video content may require better hardware or bandwidth.'
                },
                {
                    id: 'contact-support',
                    question: 'How do I contact support?',
                    answer: 'If you need help, reach out to your RUSHES contact or administrator. For technical issues, bugs, or feature requests, use the contact information provided by your organization. Support availability may vary depending on your setup.'
                }
            ]
        }
    ];
</script>

<div class="min-h-screen p-8">
    <div class="max-w-4xl mx-auto">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h1>
            <p class="text-white/60 text-sm">
                Find answers to common questions about using Rushes.
            </p>
        </header>

        <div class="space-y-6">
            {#each faqCategories as category}
                <div class="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                    <div class="border-b border-white/10 bg-white/5 px-6 py-4">
                        <h2 class="text-xl font-semibold text-white">{category.title}</h2>
                    </div>
                    <div class="divide-y divide-white/10">
                        {#each category.questions as faq}
                            <div class="border-b border-white/10 last:border-b-0">
                                <button
                                    onclick={() => toggleSection(faq.id)}
                                    class="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                    aria-expanded={openSections.has(faq.id)}
                                >
                                    <span class="text-sm font-medium text-white pr-4">
                                        {faq.question}
                                    </span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        class="flex-shrink-0 text-white/70 transition-transform {openSections.has(faq.id)
                                            ? 'rotate-180'
                                            : ''}"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>
                                {#if openSections.has(faq.id)}
                                    <div class="px-6 pb-4 text-sm text-white/70 leading-relaxed">
                                        {faq.answer}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>

        <!-- Contact Section -->
        <div class="mt-12 rounded-lg border border-white/10 bg-white/5 p-8 text-center">
            <h2 class="text-xl font-semibold text-white mb-2">Still have questions?</h2>
            <p class="text-sm text-white/60 mb-4">
                Can't find what you're looking for? Reach out to your RUSHES contact or administrator for assistance.
            </p>
            <a
                href="/account"
                class="inline-block rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
            >
                Visit Account Page
            </a>
        </div>
    </div>
</div>


