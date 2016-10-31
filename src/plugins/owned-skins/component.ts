"use strict";

import { simple_promise_fetch } from "../../util";
import { Ember, SkinsEmberComponent, Champion } from './definitions';
import LAYOUT = require("./layout.hbs");
import Promise = require("bluebird");

import "./style";

export default function(Ember: Ember, championDetails: any) {
    return Ember.Component.extend({
        classNames: ["skin-component"],
        layout: Ember.HTMLBars.compile(LAYOUT),

        isLoading: true,
        sortMode: "alphabetical",
        sort_alphabetical: true,
        showUnowned: false,

        init() {
            this._super.apply(this, arguments);
        },
        
        onShown: Ember.on("init", function(this: SkinsEmberComponent) {
            // Step 1: Fetch summoner id.
            simple_promise_fetch("/lol-login/v1/session").then(data => {
                const summonerId = JSON.parse(data).summonerId;

                // Step 2: Fetch owned champions and skins, as well as mastery score.
                return Promise.all([
                    simple_promise_fetch(`/lol-collections/v1/inventories/${summonerId}/champions`),
                    simple_promise_fetch(`/lol-collections/v1/inventories/${summonerId}/champion-mastery`)
                ]);
            }).then(([championData, championMasteryData]) => {
                // Store our mastery data for sorting later.
                this._mastery = JSON.parse(championMasteryData);

                const champs: Champion[] = JSON.parse(championData);
                champs.forEach(c => {
                    // Since we cannot put expressions in handlebars, we compute various properties here.
                    c.ownedSkins = c.skins.filter(s => s.ownership.owned && s.name !== c.name);
                    c.allSkins = c.skins.slice(1); // Remove default skin.
                });

                // Store the data, sort alphabetically by default.
                this._data = champs.filter(x => x.ownedSkins.length > 0);
                this._data.sort(sortAlphabetically);

                // Compute skin counts for the display on the left.
                this.set("ownedSkinCount", champs.reduce((a, b) => a + b.ownedSkins.length, 0));
                this.set("totalSkinCount", champs.reduce((a, b) => a + b.allSkins.length, 0));

                this.set("champions", Ember.A(this._data));
                this.set("isLoading", false);
            });
        }),

        actions: {
            sort(this: SkinsEmberComponent, mode: "alphabetical" | "mastery" | "count") {
                if (mode === this.get("sortMode")) return;

                // Unset previous, set new property to update the visual component.
                this.set("sort_" + this.get("sortMode"), undefined);
                this.set("sort_" + mode, true);
                this.set("sortMode", mode);

                // For each of the following cases, we modify the `_data` array,
                // then update the champions property. The reason we call .slice()
                // on the array is that Ember doesn't seem to pick up on the change
                // unless we actually give it a _different_ array instance.
                if (mode === "alphabetical") {
                    this._data.sort(sortAlphabetically);
                    this.set("champions", Ember.A(this._data.slice()));
                } else if (mode === "count") {
                    this._data.sort((a: any, b: any) => b.ownedSkins.length - a.ownedSkins.length);
                    this.set("champions", Ember.A(this._data.slice()));
                } else if (mode === "mastery") {
                    this._data.sort((a: any, b: any) => {
                        const masteryA = this._mastery.filter(x => x.championId === a.id)[0];
                        const masteryB = this._mastery.filter(x => x.championId === b.id)[0];
                        return (masteryB ? masteryB.championPoints : 0) - (masteryA ? masteryA.championPoints : 0);
                    });
                    this.set("champions", Ember.A(this._data.slice()));
                }
            },

            toggleUnowned(this: SkinsEmberComponent) {
                // This simply toggles the variable. The handlebars view will
                // handle the rest of the updates.
                this.set("showUnowned", !this.get("showUnowned"));
            },

            // Opens the specified champion in the lol-champion-details view.
            // TODO(molenzwiebel): Make sure to open the skins tab.
            open(this: SkinsEmberComponent, champ: Champion) {
                championDetails.show({ championId: champ.id });
            }
        }
    });
}

// Utility method that does what its name suggests.
function sortAlphabetically(a: { name: string }, b: { name: string }) {
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
}