# Carried equipment and the working day · 0.8

The original RPG, currency, item IDs, recipes and save key remain shared. No new project or separate inventory economy is introduced.

`pack.js` owns carried stack capacity, row purchases, physical overflow bundles and daily work energy. `pack-ui.js` renders the equipment row and inventory, while the existing tool system supplies all eight choices. Keys 1–8 and both visible rows select the same active tool. Weapon selection uses the actual equipped RPG weapon; armor and alternate weapons remain in the existing equipment manager.

A new player starts with eight cargo slots. Each item type stacks in one slot. Mira sells one additional row per purchase for 60, 180, 450 and 900 G, up to forty cargo slots. Key quest objects, permanent picks and combat-only progression rewards use the separate key pouch. Existing unique RPG gear remains in the equipment manager. Purchases require an open, nearby shop and enough gold, and reject a new stack when the bag is full before taking payment.

Every known inventory field uses an enumerable accessor so gathering, mining, fishing, crafting, cancel refunds, quests and combat rewards obey the same capacity boundary. New stacks that do not fit become persistent map bundles at the player's feet. Nearby bundles of the same type merge. Collection removes a bundle once and requires space, the same map and physical proximity. Manual dropping and chest transfers preserve exact quantities. Bundle rendering and mouse/touch interaction use the real world object list.

## Daily work energy

Daily energy starts at 100, separately from regenerating combat stamina. Logging costs 5, mining 6, gathering 2–3, fishing 7, tilling 3, planting and watering 1, harvesting 2, smelting 3, equipment crafting 8, enhancement 9 and other processing 2. Feeding costs 1 and collecting animal products costs 2. Actions first verify their prerequisites and then reserve their energy and materials once. Cancelling returns reserved materials and gold, but does not return effort already spent. Failed actions never deplete resources or charge ingredients. Time, wells and combat food do not restore daily energy.

I → End your day opens contextual rest. In the safe village, camping advances to the next morning and restores 28 energy, capped at 55. The inn costs 12 G and restores 60, capped at 90. Sleeping inside an owned house restores 100. A recovery cap never reduces energy already above that cap. The existing overnight crop, animal, calendar and shipping simulation still runs.

The first house purchase provides a physical chest and bed without further crafting costs. Existing owned houses also receive missing furnishings where space allows, without replacing placed objects. Inventory storage access requires being inside an owned house. Chest capacity counts distinct stacks plus stored unique gear: 24, 40 or 56 slots. Adding to an existing stored stack remains possible at capacity; withdrawing a new stack requires a free bag slot.

## Persistence and checks

Save schema v5 accepts optional, validated `pack` state, allowing existing v5 saves to migrate in place. Older inventories receive enough rows for their existing carried types, up to five; further items remain as saved bundles. Work energy, unlocked rows, bundle IDs/positions and home contents survive reloading. Furnishing does not repeat on reload.

`npm test` checks stack conservation, overflow settlement, exact upgrade prices, invalid saves, legacy migration, energy and storage boundaries, alongside the existing RPG tests. `npm run test:pack` uses Chromium to exercise numeric shortcuts, real mouse mining at low energy, persistent overflow, camping, shop expansion/buy/sell, mined ore → smelting → weapon crafting/equipping with exact energy and input costs, paid inn sleep, a purchased house, chest deposits/withdrawals, home recovery and reload. Its explicit fixtures supply money and initial full-bag/low-energy conditions; they do not invoke reward settlement. A separate 390px touch viewport checks equipment selection, row purchase, horizontal overflow and close-button access.
