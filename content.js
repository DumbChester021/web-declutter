// --- GLOBAL STATE ---
let overallBlocked = 0;
let sessionBlocked = 0;
let whitelist = [];

// Listen for the popup asking for the session count
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStats") {
    sendResponse({ sessionBlocked: sessionBlocked });
  }
});

function findPostWrapper(element) {
  let current = element;
  while (current && current !== document.body) {
    if (
      current.getAttribute("role") === "article" ||
      current.getAttribute("aria-posinset") ||
      (current.getAttribute("data-pagelet") &&
        current.getAttribute("data-pagelet").startsWith("FeedUnit_"))
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function addToHistory(posterName, posterLink) {
  chrome.storage.local.get(["blockedHistory"], (data) => {
    let history = data.blockedHistory || [];
    // Prevent spamming the exact same post multiple times
    if (history.length === 0 || history[0].name !== posterName) {
      history.unshift({
        name: posterName,
        link: posterLink,
        time: new Date().toLocaleTimeString(),
      });
      // Keep only the last 50 blocked posts so storage doesn't get full
      if (history.length > 50) history = history.slice(0, 50);
      chrome.storage.local.set({ blockedHistory: history });
    }
  });
}

function processPost(profileNameNode) {
  const postWrapper = findPostWrapper(profileNameNode);
  if (!postWrapper || postWrapper.dataset.cleaned === "true") return;

  // 1. Safe Name Extraction
  const nameElement =
    profileNameNode.querySelector("b, strong") || profileNameNode;
  let posterName = nameElement.textContent.trim().split("·")[0].trim();
  if (!posterName) posterName = "Unknown Page";

  // Extract Link
  const linkEl =
    profileNameNode.closest("a") || profileNameNode.querySelector("a");
  let posterLink = linkEl ? linkEl.href : "#";

  let isSuggestion = false;

  // 2. Find the "Header" area
  let headerBlock = profileNameNode;
  for (let i = 0; i < 3; i++) {
    if (headerBlock.parentElement) headerBlock = headerBlock.parentElement;
  }

  // Look for "Follow" or "Join" buttons
  const headerButtons = headerBlock.querySelectorAll('div[role="button"]');
  for (let btn of headerButtons) {
    const text = btn.textContent.trim();
    if (text === "Follow" || text === "Join") {
      isSuggestion = true;
      break;
    }
  }

  // Look for "Suggested for you"
  const topText = postWrapper.textContent.substring(0, 300);
  if (
    topText.includes("Suggested for you") ||
    topText.includes("Suggested page") ||
    topText.includes("Suggested groups")
  ) {
    isSuggestion = true;
  }

  // --- WHITELIST CHECK ---
  if (isSuggestion && whitelist.includes(posterName)) {
    if (!postWrapper.querySelector(".whitelist-badge")) {
      const badge = document.createElement("div");
      badge.className = "whitelist-badge";
      badge.style.cssText =
        "background: #e7f3ff; color: #1877f2; padding: 4px 8px; font-size: 12px; font-weight: bold; border-radius: 6px; display: inline-block; margin: 12px 16px 0px 16px; border: 1px solid #bcdcff;";
      badge.innerText = "⭐ Whitelisted Suggestion";
      postWrapper.prepend(badge);
    }
    postWrapper.dataset.cleaned = "true";
    return;
  }

  // --- HIDE POST & ADD BUTTONS ---
  if (isSuggestion) {
    // Update stats & History
    sessionBlocked++;
    overallBlocked++;
    chrome.storage.local.set({ overallBlocked: overallBlocked });
    addToHistory(posterName, posterLink);

    // Hide original contents safely
    const originalChildren = Array.from(postWrapper.children);
    originalChildren.forEach((child) => (child.style.display = "none"));

    // Create the control bar
    const controlBar = document.createElement("div");
    controlBar.style.cssText =
      "padding: 12px; margin: 8px 0; border-radius: 8px; background: #f0f2f5; color: #65676B; font-size: 13px; text-align: center; border: 1px solid #ddd; font-family: 'Segoe UI', sans-serif;";

    // Text message
    const textSpan = document.createElement("span");
    textSpan.innerHTML = `Post from <strong>"${posterName}"</strong> hidden. Reason: Suggestion <br><br>`;
    controlBar.appendChild(textSpan);

    // --- BUTTON: Toggle Show/Hide Post ---
    let isHidden = true;
    const showBtn = document.createElement("button");
    showBtn.innerText = "👁️ Show Post";
    showBtn.style.cssText =
      "cursor: pointer; background: #fff; border: 1px solid #ccd0d5; padding: 6px 12px; border-radius: 6px; margin-right: 10px; font-weight: bold; color: #4b4f56;";

    showBtn.onclick = () => {
      isHidden = !isHidden;
      if (isHidden) {
        originalChildren.forEach((child) => (child.style.display = "none"));
        showBtn.innerText = "👁️ Show Post";
      } else {
        originalChildren.forEach((child) => (child.style.display = ""));
        showBtn.innerText = "🙈 Hide Post";
      }
    };
    controlBar.appendChild(showBtn);

    // --- BUTTON: Whitelist ---
    const whitelistBtn = document.createElement("button");
    whitelistBtn.innerText = "⭐ Whitelist Page";
    whitelistBtn.style.cssText =
      "cursor: pointer; background: #e7f3ff; border: 1px solid #bcdcff; padding: 6px 12px; border-radius: 6px; font-weight: bold; color: #1877f2;";

    whitelistBtn.onclick = () => {
      whitelist.push(posterName);
      chrome.storage.local.set({ whitelist: whitelist });

      controlBar.style.display = "none"; // Remove control bar completely
      originalChildren.forEach((child) => (child.style.display = "")); // Restore post

      const badge = document.createElement("div");
      badge.style.cssText =
        "background: #e7f3ff; color: #1877f2; padding: 4px 8px; font-size: 12px; font-weight: bold; border-radius: 6px; display: inline-block; margin: 12px 16px 0px 16px; border: 1px solid #bcdcff;";
      badge.innerText = "⭐ Whitelisted Suggestion";
      postWrapper.prepend(badge);
    };
    controlBar.appendChild(whitelistBtn);

    // Insert the control bar at the top of the post wrapper
    postWrapper.prepend(controlBar);
  }

  // Mark as processed
  postWrapper.dataset.cleaned = "true";
}

const observer = new MutationObserver((mutations) => {
  const profileNodes = document.querySelectorAll(
    '[data-ad-rendering-role="profile_name"]:not(.processed)',
  );
  profileNodes.forEach((node) => {
    node.classList.add("processed");
    processPost(node);
  });
});

// STARTUP: Load data from storage FIRST, then start the observer
chrome.storage.local.get(["overallBlocked", "whitelist"], (data) => {
  overallBlocked = data.overallBlocked || 0;
  whitelist = data.whitelist || [];

  // Now start watching the page
  observer.observe(document.body, { childList: true, subtree: true });
});
