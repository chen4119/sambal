export const UPDATE_LOCATION = 'UPDATE_LOCATION';

export const updateLocation = (location) => async (dispatch, getState) => {
    const path = decodeURIComponent(location.pathname);
    const page = path;
    dispatch({
        type: UPDATE_LOCATION,
        page
    });

    /*
    const lazyLoadComplete = getState().app.lazyResourcesLoaded;
    // load lazy resources after render and set `lazyLoadComplete` when done.
    if (!lazyLoadComplete) {
        requestAnimationFrame(async () => {
        await import('../components/lazy-resources.js');
            dispatch({
                type: RECEIVE_LAZY_RESOURCES
            });
        });
    }*/
};