// ==UserScript==
// @name         Grepo Market Watcher
// @description  Watch market for ressource slots
// @author       @lymih
// @include             http://*.grepolis.com/game/*
// @include             https://*.grepolis.com/game/*
// @exclude             view-source://*A
// @grant               none

// ==/UserScript==

(() => {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener("load", function() {
            let splittedUrl = url.split("?");
            let action = splittedUrl[0];

            switch(action) {
                case "/game/map_data":
                    getMainMenu();
                    break;
            }
        });
        originalOpen.apply(this, arguments);
    };
})();

let marketDialog;
let watcherInterval = null;
let isWatcherRunning = false;
let menuAdded = false;
let isCheckingGold = false; 

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

function getMainMenu() {
    const observer = new MutationObserver((mutations, obs) => {
        const mainMenu = document.querySelector('.nui_main_menu');
        const lastMenuItem = mainMenu.querySelector('li.forum');
        if (lastMenuItem) {
            obs.disconnect();

            setTimeout(() => {
                addMarketWatcherMenu(lastMenuItem);
            }, 500);
        }
    });

    observer.observe(document, { childList: true, subtree: true });
}


function addMarketWatcherMenu(lastMenuItem) {
    if (document.querySelector('#market_watcher')) {
        return;
    }

    if(menuAdded == true) {
        return;
    } else {
        let customMenuItem = `
        <li class="market_watcher main_menu_item" data-option-id="market_watcher">
            <span class="content_wrapper">
                <span class="button_wrapper">
                    <span class="button">
                        <span class="icon"></span>
                    </span>
                </span>
    
                <span class="name_wrapper">
                    <span class="name">NeuilleBot</span>
                </span>
            </span>
        </li>
        `;
    
        lastMenuItem.insertAdjacentHTML('afterend', customMenuItem);
    
        document.querySelector('.market_watcher').addEventListener('click', openMarketDialog);
        menuAdded = true;
    }
}

function openMarketDialog() {
    if(marketDialog) {
        marketDialog.close();
    }

    marketDialog = Layout.wnd.Create(GPWindowMgr.TYPE_DIALOG, 'Neuille', {width: 660, height: 490, minimizable: true});
    let content = `
    <div class="" style="width: 660px; height: 400px;">
        <div class="button_container" style="display: flex; justify-content: center;">
            <div class="button_new" id="startMarketWatcher">
                <div class="left"></div>
                <div class="right"></div>
                <div class="caption">
                    <span>Start Market Watcher</span>
                </div>
            </div>
        </div>


        <div class="">
            <div class="game_border">
                <div class="game_border_top"></div>
                <div class="game_border_bottom"></div>
                <div class="game_border_left"></div>
                <div class="game_border_right"></div>
                <div class="game_border_corner corner1"></div>
                <div class="game_border_corner corner2"></div>
                <div class="game_border_corner corner3"></div>
                <div class="game_border_corner corner4"></div>

                <div class="game_header bold">Console</div>
                <div class="game_inner_box">
                    <ul class="game_list" id="goldWatcherConsole" style="max-height: 320px; overflow-y: auto;">
                    </ul>
                </div>
            </div>
        </div>

        <div>
            <span>Arreter le script avant de fermer la fenetre, si la fenetre est fermé pendant que le script est en cours, elle ne foncitonnera pas, uniquement réduire la fenetre si le script est en cours</span>
        </div>
    </div>
    `;

    marketDialog.setContent(content);
    document.querySelector('#startMarketWatcher').addEventListener('click', toggleWatcher);
}

function logToConsoleList(message) {
    const consoleList = document.querySelector('#goldWatcherConsole');
    const listItem = document.createElement('li');

    // Alternate between "odd" and "even" classes for styling
    const isOdd = consoleList.children.length % 2 === 0;
    listItem.className = isOdd ? 'odd' : 'even';

    listItem.textContent = message;
    consoleList.appendChild(listItem);

    // Scroll to the bottom to show the latest message
    consoleList.scrollTop = consoleList.scrollHeight;
}

async function startWatcher() {
    try {
        if (!isCheckingGold) {
            logToConsoleList("Recherche de gold...");
            sleep(5 * 1000);
            const data55 = await fetchTownData();
            sleep(15 * 1000);
            checkGold(data55);
        }
    } catch (error) {
        logToConsoleList("Erreur dans le processus:");
    }
}

function toggleWatcher() {
    const buttonCaption = document.querySelector('#startMarketWatcher .caption span');

    if (isWatcherRunning) {
        // Stop the watcher
        clearInterval(watcherInterval);
        watcherInterval = null;
        isWatcherRunning = false;
        buttonCaption.textContent = "Start Watcher";
        logToConsoleList("Watcher stopped.");
    } else {
        logToConsoleList("Watcher started.");
        startWatcher();
        watcherInterval = setInterval(startWatcher, 15000);
        isWatcherRunning = true;
        buttonCaption.textContent = "Stop Watcher";
    }
}

async function fetchTownData() {
    return new Promise((resolve, reject) => {
        gpAjax.ajaxGet("frontend_bridge", "execute", {
            model_url: "PremiumExchange",
            action_name: "read"
        }).done(function(response) {
            try {
                const data = typeof response === "string" ? JSON.parse(response) : response;
                resolve(data);
            } catch (error) {
                reject("Error parsing response: " + error);
            }
        }).fail(function(error) {
            reject(error);
        });
    });
}

async function requestMarket(resourceType, diffAmount) {
    return new Promise((resolve, reject) => {
        gpAjax.ajaxPost("frontend_bridge", "execute", {
            model_url: "PremiumExchange",
            action_name: "requestOffer",
            arguments: {
                type: "sell",
                gold: diffAmount,
                [resourceType]: diffAmount
            },
            nl_init: true
        }).done(function(response) {
            try {
                const data = typeof response === "string" ? JSON.parse(response) : response;
                resolve(data);
            } catch (error) {
                reject("Error parsing response: " + error);
            }
        }).fail(function(error) {
            reject(error);
        });
    });
}

async function confirmMarket(data) {
    return new Promise((resolve, reject) => {
        gpAjax.ajaxPost("frontend_bridge", "execute", {
            model_url: "PremiumExchange",
            action_name: "confirmOffer",
            arguments: {
                type: data.offer.type,
                gold: data.offer.gold,
                mac: data.mac,
                offer_source: "main",
                [data.offer.resource_type]: data.offer.resource_amount
            },
            town_id: data.offer.town_id,
            nl_init: true
        }).done(function(response) {
            try {
                const data = typeof response === "string" ? JSON.parse(response) : response;
                resolve(data);
            } catch (error) {
                reject("Error parsing response: " + error);
            }
        }).fail(function(error) {
            reject(error);
        });
    });
}

async function checkGold(data) {
    if (data.json) {
        isCheckingGold = true;

        let requestWood, confirmWood, requestStone, confirmStone, requestIron, confirmIron, rateChangedWood;

        const woodDiff = data.json.wood.capacity - data.json.wood.stock;
        const stoneDiff = data.json.stone.capacity - data.json.stone.stock;
        const ironDiff = data.json.iron.capacity - data.json.iron.stock;

        if (woodDiff >= 500) {
            logToConsoleList(`${GameData.currencies.gold.name} ${data.json.sea_id}, ${woodDiff} ${GameData.resource_names.wood}`)
            logToConsoleList(`Selling ${woodDiff} ${GameData.resource_names.wood}...`)

            await sleep(15 * 1000);

            requestWood = await requestMarket("wood", woodDiff);

            if(requestWood.json.result == "success") {
                if(requestWood.json.offer.captcha_required == true) {
                    clearInterval(watcherInterval);
                    watcherInterval = null;
                    isCheckingGold = false;
                    isWatcherRunning = false;

                    logToConsoleList("Aborted due to CAPTCHA requirement.");
                    return;
                } else {
                    await sleep(15 * 1000);
                    confirmWood = await confirmMarket(requestWood.json);
    
                    if(confirmWood.json.result == "rate_changed") {
                        await sleep(10 * 1000);
                        rateChangedWood = await confirmMarket(confirmWood.json);
    
                        if(rateChangedWood.json.result == "success") {
                            logToConsoleList(`Sold ${confirmWood.json.offer.resource_amount} ${GameData.resource_names[confirmWood.json.offer.resource_type]} for ${confirmWood.json.offer.gold} ${GameData.currencies.gold.name}`)
                        }
                    }
    
                    if(confirmWood.json.result == "success") {
                        logToConsoleList(`Sold ${requestWood.json.offer.resource_amount} ${GameData.resource_names[requestWood.json.offer.resource_type]} for ${requestWood.json.offer.gold} ${GameData.currencies.gold.name}`)
                    }
                }
            }
        }

        if (stoneDiff >= 500) {
            logToConsoleList(`${GameData.currencies.gold.name} ${data.json.sea_id}, ${stoneDiff} ${GameData.resource_names.stone}`)
            logToConsoleList(`Selling ${stoneDiff} ${GameData.resource_names.stone}...`)

        }

        if (ironDiff >= 500) {
            logToConsoleList(`${GameData.currencies.gold.name} ${data.json.sea_id}, ${ironDiff} ${GameData.resource_names.iron}`)
            logToConsoleList(`Selling ${ironDiff} ${GameData.resource_names.iron}...`)

        }

        isCheckingGold = false;
    } else {
        logToConsoleList("Données manquantes");
    }
}



