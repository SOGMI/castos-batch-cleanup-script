import { getEpisodesIds, handleEpisodes, getEpisodes } from "./index";

const main = async () => {
    const ids = await getEpisodesIds();
    const episodes = await getEpisodes(ids);
    return handleEpisodes(episodes);
};

main().catch((err) => {
    throw err;
});
