import Axios from "axios";
import Bottleneck from "bottleneck";
import { pathExists, readJson, writeJson } from "fs-extra";
import { add, format } from "date-fns";

require("dotenv").config();

const API_BASE = "https://app.castos.com/api/v2";
const TOKEN = process.env.CASTOS_TOKEN;
const PODCAST_ID = "9";

export interface EpisodeListPayload {
    id: number;
    post_title: string;
    created_at: string;
    post_data: string;
    youtube_id: string | null;
}

export const getEpisodes = async (ids: number[]): Promise<EpisodePayload[]> => {
    return new Promise(async (resolve, reject) => {
        const limiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 1500,
        });

        const episodes: EpisodePayload[] = [];
        const total = ids.length;
        let tasksFinished = 0;
        for (const id of ids) {
            const tmpFile = `.temp/episode_${id}.json`;
            const tmpFileExists = await pathExists(tmpFile);
            if (tmpFileExists) {
                await readJson(tmpFile).then((result) => {
                    console.log("fetched episode ", id);
                    tasksFinished++;
                    episodes.push(result as EpisodePayload);
                });
                // continue to next loop
                continue;
            }

            limiter.schedule(async () => {
                return getEpisodeById(id)
                    .then((result) => {
                        console.log("fetched episode ", id);
                        episodes.push(result);

                        return writeJson(tmpFile, result);
                    })
                    .then(() => {
                        tasksFinished++;
                    });
            });
        }
        if (tasksFinished === total) {
            return resolve(episodes);
        }
        limiter.on("done", () => {
            if (tasksFinished === total) {
                return resolve(episodes);
            }
        });
    });
};

export const getEpisodesIds = async () => {
    const episodes = await Axios.get(
        `${API_BASE}/podcasts/${PODCAST_ID}/episodes?token=${TOKEN}`
    ).then((result) => {
        return result.data.data as EpisodeListPayload[];
    });

    const ids: number[] = [];
    for (const episode of episodes) {
        ids.push(episode.id);
    }
    return ids;
};

export interface EpisodeFile {
    id: number;
    user_id: number;
    episode_id: number;
    file_name: string;
    file_path: string;
    created_at: string;
    updated_at: string;
    file_size: string;
    file_type: string;
    file_duration: string;
    file_type_id: number;
}

export interface EpisodePayload {
    id: number;
    post_id: string;
    post_title: string;
    post_content: string;
    post_date: string;
    user_id: number;
    created_at: string;
    updated_at: string;
    keywords: string;
    series_number: string;
    episode_number: string;
    episode_image: string;
    episode_type: string;
    explicit: null | boolean;
    post_slug: string;
    youtube_id: null | string;
    republish_triger: number;
    podcast_id: number;
    website_sync: number;
    transcript_id: null | number;
    episode_status_id: number;
    file: EpisodeFile;
}

export const getEpisodeById = async (id: number) => {
    const episode = await Axios.get(
        `${API_BASE}/podcasts/${PODCAST_ID}/episodes/${id}?token=${TOKEN}`
    ).then((result) => {
        return result.data.data as EpisodePayload;
    });
    return episode;
};

export interface EpisodeUpdatePayload {
    post_title?: string;
    post_content?: string;
    episode_file?: any;
    updated_episode_file?: any;
    keywords?: string;
    series_number?: string;
    episode_number?: string;
    episode_type?: string;
    episode_image?: any;
    post_date?: string | Date;
}

export const updateEpisode = (id: number, payload: EpisodeUpdatePayload) => {
    return Axios.post(
        `${API_BASE}/podcasts/${PODCAST_ID}/episodes/${id}?token=${TOKEN}`,
        payload
    );
};

export const getDateFromFilename = (filename: string) => {
    const parts = filename.split("-");
    let month: string;
    let day: string;
    let year: string;

    if (filename.includes("TPVOT-")) {
        // Coby's old filename format
        // TPVOT-E{num}-{yy}-{mm}-{dd}-{dd}-{title-slug}.mp3
        month = parts[3];
        day = parts[5];
        year = `20${parts[2]}`;
    } else if (!isNaN(Number(parts[4]))) {
        // standard file format two separate dates
        // {mm1}-{dd1}-{yy1}-{mm2}-{dd2}-{yy2}-prophetic-voice-of-our-time-[mixdown]-01.mp3
        month = parts[3];
        day = parts[4];
        year = `20${parts[5]}`;
    } else {
        // standard file format
        // {mm}-{dd}-{dd}-{yy}-{title-slug}-[mixdown]-01.mp3
        month = parts[0];
        day = parts[2];
        year = `20${parts[3]}`;
    }
    const airDate = Date.parse(`${month}/${day}/${year} 10:00 AM CST`);
    const publishDate = add(airDate, { days: 1 });
    return publishDate;
};

const handleEpisodesUpdate = (episodes: MappedEpisode[]) => {
    return new Promise((resolve, reject) => {
        const limiter = new Bottleneck({
            maxConcurrent: 1,
            minTime: 1500,
        });
        let finishedTasks = 0;
        for (const ep of episodes) {
            limiter.schedule(() => {
                return updateEpisode(ep.id, {
                    post_date: format(ep.post_date, "yyyy-MM-dd hh:mm:ss"),
                    post_title: ep.post_title,
                    episode_number: ep.episode_number,
                }).then(() => {
                    console.log("updated episode ", ep.id);
                    finishedTasks++;
                });
            });
        }
        limiter.on("done", () => {
            if (finishedTasks === episodes.length) {
                resolve(null);
            }
        });
        limiter.on("error", (err) => {
            reject(err);
        });
    });
};

interface MappedEpisode {
    id: number;
    post_title: string;
    post_date: Date;
    episode_number: string;
}

const mappedEpisodeCompare = (a: MappedEpisode, b: MappedEpisode) => {
    if (a.post_date > b.post_date) {
        return 1;
    }
    return -1;
};

export const handleEpisodes = (episodes: EpisodePayload[]) => {
    const mappedEpisodes: MappedEpisode[] = [];
    for (const episode of episodes) {
        const mapped: MappedEpisode = {
            id: episode.id,
            post_title: episode.post_title,
            post_date: getDateFromFilename(episode.file.file_name),
            episode_number: episode.episode_number,
        };
        mappedEpisodes.push(mapped);
    }
    mappedEpisodes.sort(mappedEpisodeCompare);
    let epNum = 339;
    for (const ep of mappedEpisodes) {
        ep.episode_number = `${epNum}`;
        if (ep.post_title.charAt(0) === " ") {
            ep.post_title = ep.post_title.substring(1);
        }
        ep.post_title = `Episode ${epNum}: ${ep.post_title}`;
        console.log(ep.post_date);
        epNum++;
    }
    // return handleEpisodesUpdate(mappedEpisodes);
};
