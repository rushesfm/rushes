<script lang="ts">
    interface Props {
        year: number;
        month: number; // 1-12
        datesWithVideos?: Set<string>;
        onMonthChange?: (year: number, month: number) => void;
    }

    let { year, month, datesWithVideos = new Set(), onMonthChange }: Props = $props();

    // Format month name
    function formatMonth(month: number): string {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return monthNames[month - 1] || String(month);
    }

    // Get calendar days for a month (returns array of day numbers, with null for days outside the month)
    function getCalendarDays(year: number, month: number): (number | null)[] {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        const days: (number | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    }

    // Get date string for year/month/day
    function getDateStr(year: number, month: number, day: number): string {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // Format date for display
    function formatDate(year: number, month: number, day: number): string {
        const dayStr = String(day).padStart(2, "0");
        const monthStr = String(month).padStart(2, "0");
        return `${dayStr}/${monthStr}/${year}`;
    }

    // Check if a date has videos
    function hasVideos(year: number, month: number, day: number): boolean {
        const dateStr = getDateStr(year, month, day);
        return datesWithVideos.has(dateStr);
    }

    // Navigate to previous month
    function previousMonth() {
        let newYear = year;
        let newMonth = month - 1;
        
        if (newMonth < 1) {
            newMonth = 12;
            newYear = year - 1;
        }
        
        if (onMonthChange) {
            onMonthChange(newYear, newMonth);
        }
    }

    // Navigate to next month
    function nextMonth() {
        let newYear = year;
        let newMonth = month + 1;
        
        if (newMonth > 12) {
            newMonth = 1;
            newYear = year + 1;
        }
        
        if (onMonthChange) {
            onMonthChange(newYear, newMonth);
        }
    }

    const calendarDays = $derived(getCalendarDays(year, month));
</script>

<div class="month-calendar">
    <!-- Month/Year Header with Navigation -->
    <div class="calendar-header">
        <button
            onclick={previousMonth}
            class="calendar-nav-btn"
            aria-label="Previous month"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="calendar-nav-icon"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                />
            </svg>
        </button>
        <h3 class="calendar-title">
            {formatMonth(month)} {year}
        </h3>
        <button
            onclick={nextMonth}
            class="calendar-nav-btn"
            aria-label="Next month"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="calendar-nav-icon"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                />
            </svg>
        </button>
    </div>

    <!-- Calendar Header (Day names) -->
    <div class="calendar-days-header">
        {#each ["S", "M", "T", "W", "T", "F", "S"] as dayName}
            <div class="calendar-day-name">{dayName}</div>
        {/each}
    </div>

    <!-- Calendar Days Grid -->
    <div class="calendar-days-grid">
        {#each calendarDays as day}
            {#if day === null}
                <div class="calendar-day-empty"></div>
            {:else}
                {@const dateStr = getDateStr(year, month, day)}
                {@const hasVideo = hasVideos(year, month, day)}
                <a
                    href="/date/{dateStr}"
                    class="calendar-day {hasVideo ? 'has-video' : ''}"
                    title={hasVideo ? `Videos available on ${formatDate(year, month, day)}` : formatDate(year, month, day)}
                >
                    {day}
                </a>
            {/if}
        {/each}
    </div>
</div>

<style>
    .month-calendar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .calendar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .calendar-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        margin: 0;
        flex: 1;
        text-align: center;
    }

    .calendar-nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        border-radius: 0.375rem;
        transition: all 0.2s ease;
    }

    .calendar-nav-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }

    .calendar-nav-icon {
        width: 16px;
        height: 16px;
    }

    .calendar-days-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
        margin-bottom: 0.5rem;
    }

    .calendar-day-name {
        text-align: center;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        font-weight: 500;
        padding: 0.25rem 0;
    }

    .calendar-days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
    }

    .calendar-day-empty {
        aspect-ratio: 1;
    }

    .calendar-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.4);
        text-decoration: none;
        border-radius: 0.25rem;
        transition: all 0.2s ease;
        border: 1px solid transparent;
    }

    .calendar-day:hover {
        color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.05);
    }

    .calendar-day.has-video {
        background: rgba(251, 146, 60, 0.2);
        color: rgb(251, 146, 60);
        border-color: rgba(251, 146, 60, 0.4);
    }

    .calendar-day.has-video:hover {
        background: rgba(251, 146, 60, 0.3);
    }
</style>

