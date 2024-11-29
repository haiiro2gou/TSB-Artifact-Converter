import path from "path";
import { promises as fsp } from "fs";
import { readFile, writeFile, readDir, recursiveReadDir } from "../utils/io";
import { makeIMPDoc } from "../utils/minecraft";

interface StringMap {
    [key: string]: string;
}
const triggerMap: StringMap = {
    passive: "tick",
    onClick: "click",
    itemUse: "use_item",
    onAttack: "attack",
    onAttackByMelee: "attack_melee",
    onAttackByProjectile: "attack_projectile",
    onDamage: "damage",
    onDamageFromMelee: "damage_melee",
    onDamageFromProjectile: "damage_projectile",
    onDamageFromExplode: "damage_explosion",
    onDamageFromBurn: "damage_burn",
    onDamageFromEntity: "damage_entity",
    onKilled: "kill",
    onKilledByMelee: "kill_melee",
    onKilledByProjectile: "kill_projectile",
    sneak: "sneak",
    sneak1s: "sneak_1s",
    sneak2s: "sneak_2s",
    sneak3s: "sneak_3s",
    sneak4s: "sneak_4s",
    sneak5s: "sneak_5s",
    sneak10s: "sneak_10s",
    keepSneak: "keep_sneak",
    keepSneak1s: "keep_sneak_1s",
    keepSneak2s: "keep_sneak_2s",
    keepSneak3s: "keep_sneak_3s",
    keepSneak4s: "keep_sneak_4s",
    keepSneak5s: "keep_sneak_5s",
    keepSneak10s: "keep_sneak_10s",
    equipping: "equip",
    onHeal: "heal",
    onReceiveHeal: "receive_heal",
};

function replaceTrigger(line: string, trigger: string): string {
    return line
        .replace(/\/trigger\//, `/${trigger}/`)
        .replace(/2.check_condition/, "check")
        .replace(/3.main/, "");
}

export async function updateArtifactRegistry(
    inputPath: string,
    outputPath: string
) {
    const assets = await readDir(path.join(inputPath));
    const assetDir = (
        await Promise.all(
            assets.map(async v =>
                (await fsp.stat(v)).isDirectory() ? v : null
            )
        )
    ).filter(v => v !== null);
    for (const dir of assetDir) {
        const idStr = path.relative(inputPath, dir);
        const id = Number(idStr.substring(0, 4));
        if (idStr === "alias") continue;

        await readDir(dir).then(async v => {
            console.log(`Scanning ${idStr}...`);

            const give = v.find(v => path.relative(dir, v) === "give");
            if (give === undefined) {
                console.log(`${" ".repeat(2)}Register file not found.`);
                return;
            }
            console.log(`${" ".repeat(2)}Register file found.`);
            console.log(`${" ".repeat(2)}Updating register file...`);
            let trigger: string = "";
            await readFile(path.join(give, "2.give.mcfunction")).then(
                async lines => {
                    const match = lines
                        .split("\n")
                        .filter(v =>
                            /data modify storage asset:artifact Trigger set value (.*)/.test(
                                v
                            )
                        )[0]
                        ?.match(
                            /data modify storage asset:artifact Trigger set value (.*)/
                        );
                    trigger = match ? match[1] : "";
                    trigger = triggerMap[trigger.slice(1, -1)] || trigger;
                    const newLines = lines
                        .split("\n")
                        .slice(10, -3)
                        .map(v =>
                            replaceTrigger(
                                v.replace(
                                    /Trigger set value (.*)/,
                                    (_, p1) =>
                                        `Trigger set value "${triggerMap[String(p1).slice(1, -1)] || p1}"`
                                ),
                                trigger
                            )
                        )
                        .join("\n");
                    await writeFile(
                        path.join(outputPath, idStr, "register.mcfunction"),
                        [
                            makeIMPDoc(
                                `asset:artifact/${idStr}/register`,
                                {
                                    type: "within",
                                    target: {
                                        function: [
                                            `asset:artifact/alias/${id}/register`,
                                        ],
                                    },
                                },
                                ["神器の生成処理"]
                            ),
                            newLines
                                .split("\n")
                                .map(v => replaceTrigger(v, trigger))
                                .join("\n"),
                        ].join("\n")
                    );
                    await writeFile(
                        path.join(
                            outputPath,
                            "alias",
                            id.toString(),
                            "register.mcfunction"
                        ),
                        [
                            makeIMPDoc(
                                `asset:artifact/alias/${id}/register`,
                                {
                                    type: "within",
                                    target: {
                                        function: [
                                            "asset_manager:artifact/give/register.m",
                                        ],
                                    },
                                },
                                ["神器の生成処理のエイリアス"]
                            ),
                            `function asset:artifact/${idStr}/register`,
                        ].join("\n")
                    );
                }
            );

            if (trigger === "") {
                console.log(`${" ".repeat(2)}Trigger not found. Skipping...`);
                return;
            }

            console.log(`${" ".repeat(2)}Transferring trigger file...`);
            try {
                const triggerFiles = await recursiveReadDir(
                    path.join(dir, "trigger")
                );
                for (const triggerFile of triggerFiles) {
                    if (
                        path.relative(
                            path.join(dir, "trigger"),
                            triggerFile
                        ) === "0.load.mcfunction"
                    ) {
                        await readFile(triggerFile).then(async lines => {
                            await writeFile(
                                path.join(outputPath, idStr, "load.mcfunction"),
                                [
                                    makeIMPDoc(
                                        `asset:artifact/${idStr}/load`,
                                        {
                                            type: "within",
                                            target: {
                                                // eslint-disable-next-line @typescript-eslint/naming-convention
                                                "tag/function": [
                                                    "asset:artifact/load",
                                                ],
                                            },
                                        },
                                        [
                                            "神器に利用するスコアボード等の初期化処理",
                                        ]
                                    ),
                                    lines
                                        .split("\n")
                                        .slice(6)
                                        .map(v => replaceTrigger(v, trigger))
                                        .join("\n"),
                                ].join("\n")
                            );
                        });
                        continue;
                    }
                    if (
                        path.relative(
                            path.join(dir, "trigger"),
                            triggerFile
                        ) === "1.trigger.mcfunction"
                    )
                        continue;
                    if (
                        path.relative(
                            path.join(dir, "trigger"),
                            triggerFile
                        ) === "2.check_condition.mcfunction"
                    ) {
                        await readFile(triggerFile).then(async lines => {
                            const checkLines = lines.split("\n").slice(10, -3);
                            if (checkLines.length === 0) return;
                            await writeFile(
                                path.join(
                                    outputPath,
                                    idStr,
                                    trigger,
                                    "check.mcfunction"
                                ),
                                [
                                    makeIMPDoc(
                                        `asset:artifact/${idStr}/${trigger}/check`,
                                        {
                                            type: "within",
                                            target: {
                                                function: [
                                                    `asset:artifact/alias/${id}/${trigger}/check`,
                                                ],
                                            },
                                        },
                                        ["神器の使用条件の確認処理"]
                                    ),
                                    checkLines
                                        .map(v => replaceTrigger(v, trigger))
                                        .join("\n"),
                                ].join("\n")
                            );
                            await writeFile(
                                path.join(
                                    outputPath,
                                    "alias",
                                    id.toString(),
                                    trigger,
                                    "check.mcfunction"
                                ),
                                [
                                    makeIMPDoc(
                                        `asset:artifact/alias/${id}/${trigger}/check`,
                                        {
                                            type: "within",
                                            target: {
                                                function: [
                                                    `asset_manager:artifact/triggers/${trigger}/check.m`,
                                                ],
                                            },
                                        },
                                        ["神器の使用条件の確認処理のエイリアス"]
                                    ),
                                    `function asset:artifact/${idStr}/${trigger}/check`,
                                ].join("\n")
                            );
                        });
                        continue;
                    }
                    if (
                        path.relative(
                            path.join(dir, "trigger"),
                            triggerFile
                        ) === "3.main.mcfunction"
                    ) {
                        await readFile(triggerFile).then(async lines => {
                            const mainLines = lines.split("\n").slice(11);
                            if (mainLines.length === 0) return;
                            await writeFile(
                                path.join(
                                    outputPath,
                                    idStr,
                                    trigger,
                                    ".mcfunction"
                                ),
                                [
                                    makeIMPDoc(
                                        `asset:artifact/${idStr}/${trigger}/`,
                                        {
                                            type: "within",
                                            target: {
                                                function: [
                                                    `asset:artifact/alias/${id}/${trigger}/`,
                                                ],
                                            },
                                        },
                                        ["神器のトリガー処理のエイリアス"]
                                    ),
                                    mainLines
                                        .map(v => replaceTrigger(v, trigger))
                                        .join("\n"),
                                ].join("\n")
                            );
                            await writeFile(
                                path.join(
                                    outputPath,
                                    "alias",
                                    id.toString(),
                                    trigger,
                                    ".mcfunction"
                                ),
                                [
                                    makeIMPDoc(
                                        `asset:artifact/alias/${id}/${trigger}/`,
                                        {
                                            type: "within",
                                            target: {
                                                function: [
                                                    `asset_manager:artifact/triggers/${trigger}/${trigger}.m`,
                                                ],
                                            },
                                        },
                                        ["神器のトリガー処理のエイリアス"]
                                    ),
                                    `function asset:artifact/${idStr}/${trigger}/`,
                                ].join("\n")
                            );
                        });
                        continue;
                    }
                    await readFile(triggerFile).then(async lines => {
                        await writeFile(
                            path.join(
                                outputPath,
                                idStr,
                                trigger,
                                path.relative(
                                    path.join(dir, "trigger"),
                                    triggerFile
                                )
                            ),
                            lines
                                .split("\n")
                                .map(v => replaceTrigger(v, trigger))
                                .join("\n")
                        );
                    });
                }
            } catch (e) {
                console.error(e);
            }
        });
    }
}
