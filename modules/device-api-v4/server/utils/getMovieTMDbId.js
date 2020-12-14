async function getMovieTMDbId(title) {
  try {
    let gettmdbid = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: 'e76289b7e0306b6e6b6088148b804f01',
        language: "en-US",
        query: title
      }
    })
    if (!gettmdbid || gettmdbid.data.results.length === 0) {
      return Promise.resolve({ tmdb_values: { tmdbId: -1 } });
    } else {
      return Promise.resolve({ tmdb_values: { tmdbId: gettmdbid.data.results[0].id } });
    }
  } catch (error) {
    return Promise.resolve({ tmdb_values: { tmdbId: -1 } });
  }
}

module.exports = getMovieTMDbId