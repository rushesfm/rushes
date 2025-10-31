<script lang="ts">
    import { browser } from "$app/environment";
    import { enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";
    import { goto, invalidateAll } from "$app/navigation";
    import BreadcrumbBar from "$lib/components/BreadcrumbBar.svelte";

    interface Props {
        data: PageData;
        form: ActionData;
    }

    const { data, form }: Props = $props();
    const user = data.user;

    let name = $state(user?.name ?? "");
    let slug = $state(user?.slug ?? "");
    let bio = $state(user?.bio ?? "");
    let email = $state(user?.email ?? "");
    let avatarUrl = $state(user?.avatar ?? "");
    let avatarFile = $state<File | null>(null);
    let avatarPreview = $state<string | null>(null);

    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");

    let deleteConfirm = $state("");

    let isSubmittingProfile = $state(false);
    let isSubmittingEmail = $state(false);
    let isSubmittingPassword = $state(false);
    let isDeleting = $state(false);

    function handleAvatarChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            avatarFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarPreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    function removeAvatarPreview() {
        avatarFile = null;
        avatarPreview = null;
    }

    function handleProfileSubmit() {
        isSubmittingProfile = true;
        return async ({ result, update }: any) => {
            isSubmittingProfile = false;
            if (result.type === "success") {
                avatarFile = null;
                avatarPreview = null;
                // Reset file input
                const fileInputElement = document.getElementById('avatar') as HTMLInputElement;
                if (fileInputElement) {
                    fileInputElement.value = '';
                }
                await invalidateAll();
            } else {
                await update();
            }
        };
    }

    function handleEmailSubmit() {
        isSubmittingEmail = true;
        return async ({ result, update }: any) => {
            isSubmittingEmail = false;
            if (result.type === "success") {
                email = "";
                await update();
            } else {
                await update();
            }
        };
    }

    function handlePasswordSubmit() {
        isSubmittingPassword = true;
        return async ({ result, update }: any) => {
            isSubmittingPassword = false;
            if (result.type === "success") {
                currentPassword = "";
                newPassword = "";
                confirmPassword = "";
            }
            await update();
        };
    }

    function handleDeleteSubmit() {
        isDeleting = true;
        return async ({ result, update }: any) => {
            isDeleting = false;
            if (result.type === "success") {
                await goto("/");
            } else {
                await update();
            }
        };
    }
</script>

<svelte:head>
    <title>Manage Account - {user?.name ?? 'Account'}</title>
</svelte:head>

<div class="page">
    <BreadcrumbBar items={[
        { label: "My Account", href: "/account" },
        { label: "Manage Account" }
    ]} />

    <div class="container">
        <div class="header">
            <h1>Manage Account</h1>
            <p class="subtitle">Update your profile information, account settings, and security options</p>
        </div>

        {#if form?.error}
            <div class="alert alert-error">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                    <path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span>{form.error}</span>
            </div>
        {/if}

        {#if form?.success}
            <div class="alert alert-success">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" />
                    <path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>{form.message ?? 'Updated successfully!'}</span>
            </div>
        {/if}

        <!-- Profile Section -->
        <div class="section">
            <h2 class="section-title">Profile Information</h2>
            <p class="section-description">Update your profile information</p>

            <form method="POST" action="?/updateProfile" enctype="multipart/form-data" use:enhance={handleProfileSubmit}>
                <div class="form-group">
                    <label class="label">Profile Picture</label>
                    <div class="avatar-section">
                        <div class="avatar-preview">
                            {#if avatarPreview}
                                <img src={avatarPreview} alt="Avatar preview" />
                            {:else if avatarUrl}
                                <img src={avatarUrl} alt="Current avatar" />
                            {:else}
                                <div class="avatar-placeholder">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                            {/if}
                        </div>
                        <div class="avatar-actions">
                            <label for="avatar" class="btn btn-secondary">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Choose Image
                            </label>
                            <input
                                type="file"
                                id="avatar"
                                name="avatar"
                                accept="image/*"
                                style="display: none;"
                                onchange={handleAvatarChange}
                            />
                            {#if avatarPreview}
                                <button type="button" class="btn btn-secondary" onclick={removeAvatarPreview}>
                                    Cancel
                                </button>
                            {/if}
                        </div>
                    </div>
                    <p class="hint">Upload a profile picture (max 5MB)</p>
                </div>

                <div class="form-group">
                    <label for="name" class="label">Name *</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        class="input"
                        bind:value={name}
                        placeholder="Your full name"
                        required
                        maxlength="100"
                    />
                </div>

                <div class="form-group">
                    <label for="slug" class="label">Username *</label>
                    <input
                        type="text"
                        id="slug"
                        name="slug"
                        class="input"
                        bind:value={slug}
                        placeholder="your-username"
                        required
                        pattern="[a-z0-9-]+"
                        title="Username can only contain lowercase letters, numbers, and hyphens"
                    />
                    <p class="hint">Your username will appear in your profile URL. Only lowercase letters, numbers, and hyphens are allowed.</p>
                </div>

                <div class="form-group">
                    <label for="bio" class="label">Bio</label>
                    <textarea
                        id="bio"
                        name="bio"
                        class="textarea"
                        bind:value={bio}
                        placeholder="Tell us about yourself..."
                        rows="4"
                        maxlength="500"
                    ></textarea>
                    <p class="hint">{bio.length} / 500 characters</p>
                </div>

                <button type="submit" class="btn btn-primary" disabled={isSubmittingProfile}>
                    {#if isSubmittingProfile}
                        <div class="spinner"></div>
                        <span>Saving...</span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2"/>
                            <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>Save Profile</span>
                    {/if}
                </button>
            </form>
        </div>

        <!-- Email Section -->
        <div class="section">
            <h2 class="section-title">Email Address</h2>
            <p class="section-description">Change your email address. A confirmation email will be sent to the new address.</p>

            <form method="POST" action="?/updateEmail" use:enhance={handleEmailSubmit}>
                <div class="form-group">
                    <label for="email" class="label">New Email *</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        class="input"
                        bind:value={email}
                        placeholder="your.email@example.com"
                        required
                    />
                </div>

                <button type="submit" class="btn btn-primary" disabled={isSubmittingEmail}>
                    {#if isSubmittingEmail}
                        <div class="spinner"></div>
                        <span>Updating...</span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2"/>
                            <path d="m22 6-10 7L2 6" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>Update Email</span>
                    {/if}
                </button>
            </form>
        </div>

        <!-- Password Section -->
        <div class="section">
            <h2 class="section-title">Change Password</h2>
            <p class="section-description">Update your password to keep your account secure</p>

            <form method="POST" action="?/updatePassword" use:enhance={handlePasswordSubmit}>
                <div class="form-group">
                    <label for="currentPassword" class="label">Current Password *</label>
                    <input
                        type="password"
                        id="currentPassword"
                        name="currentPassword"
                        class="input"
                        bind:value={currentPassword}
                        placeholder="Enter current password"
                        required
                    />
                </div>

                <div class="form-group">
                    <label for="newPassword" class="label">New Password *</label>
                    <input
                        type="password"
                        id="newPassword"
                        name="newPassword"
                        class="input"
                        bind:value={newPassword}
                        placeholder="Enter new password"
                        required
                        minlength="6"
                    />
                </div>

                <div class="form-group">
                    <label for="confirmPassword" class="label">Confirm New Password *</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        class="input"
                        bind:value={confirmPassword}
                        placeholder="Confirm new password"
                        required
                        minlength="6"
                    />
                </div>

                <button type="submit" class="btn btn-primary" disabled={isSubmittingPassword}>
                    {#if isSubmittingPassword}
                        <div class="spinner"></div>
                        <span>Updating...</span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Update Password</span>
                    {/if}
                </button>
            </form>
        </div>

        <!-- Delete Account Section -->
        <div class="section section-danger">
            <h2 class="section-title">Delete Account</h2>
            <p class="section-description">Permanently delete your account and all associated data. This action cannot be undone.</p>

            <form method="POST" action="?/deleteAccount" use:enhance={handleDeleteSubmit}>
                <div class="form-group">
                    <label for="confirmText" class="label">Type DELETE to confirm *</label>
                    <input
                        type="text"
                        id="confirmText"
                        name="confirmText"
                        class="input"
                        bind:value={deleteConfirm}
                        placeholder="DELETE"
                        required
                    />
                    <p class="hint warning">This will permanently delete your account and all your videos. This action cannot be undone.</p>
                </div>

                <button type="submit" class="btn btn-danger" disabled={isDeleting || deleteConfirm !== "DELETE"}>
                    {#if isDeleting}
                        <div class="spinner"></div>
                        <span>Deleting...</span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>Delete Account</span>
                    {/if}
                </button>
            </form>
        </div>
    </div>
</div>

<style>
    .page {
        min-height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        padding: 2rem;
    }

    .container {
        max-width: 800px;
        margin: 0 auto;
    }

    .header {
        margin-bottom: 2rem;
    }

    .header h1 {
        font-size: 2rem;
        font-weight: 700;
        color: #fff;
        margin: 0 0 0.5rem 0;
    }

    .subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.9375rem;
        margin: 0;
    }

    .alert {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
        border-radius: 6px;
    }

    .alert-error {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    .alert-success {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.3);
        color: #86efac;
    }

    .section {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 2rem;
        margin-bottom: 1.5rem;
        border-radius: 8px;
    }

    .section-danger {
        border-color: rgba(239, 68, 68, 0.3);
        background: rgba(239, 68, 68, 0.05);
    }

    .section-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #fff;
        margin: 0 0 0.5rem 0;
    }

    .section-description {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 1.5rem 0;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #fff;
        margin-bottom: 0.5rem;
    }

    .input,
    .textarea {
        width: 100%;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 0.9375rem;
        font-family: inherit;
        transition: border-color 0.2s;
        outline: none;
        border-radius: 6px;
    }

    .input:focus,
    .textarea:focus {
        border-color: rgba(94, 234, 212, 0.5);
    }

    .textarea {
        resize: vertical;
        line-height: 1.6;
    }

    .hint {
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 0.5rem;
    }

    .hint.warning {
        color: #fca5a5;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border: 1px solid;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        border-radius: 6px;
    }

    .btn-primary {
        background: #5eead4;
        border-color: #5eead4;
        color: #0a0a0a;
    }

    .btn-primary:hover:not(:disabled) {
        background: #4fd1c5;
        border-color: #4fd1c5;
    }

    .btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .btn-danger {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    .btn-danger:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.4);
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .avatar-section {
        display: flex;
        align-items: center;
        gap:1rem;
        margin-bottom: 1.5rem;
    }

    .avatar-preview {
        width: 50px;
        height: 50px;
        border-radius: 10%;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        flex-shrink: 0;
    }

    .avatar-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
    }

    .avatar-actions {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
    }
</style>

