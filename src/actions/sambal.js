export const UPDATE_LOCATION = 'UPDATE_LOCATION';
export const UPDATE_SCREEN_SIZE = 'UPDATE_SCREEN_SIZE';
export const RECEIVE_LAZY_RESOURCES = 'RECEIVE_LAZY_RESOURCES';

export const updateLocation = (path) => (dispatch, getState) => {
    dispatch({
        type: UPDATE_LOCATION,
        path
    });
};

export const updateScreenSize = (isSmallScreen) => (dispatch, getState) => {
    dispatch({
        type: UPDATE_SCREEN_SIZE,
        isSmallScreen
    });
};

export const receivedLazyResources = () => (dispatch, getState) => {
    dispatch({
        type: RECEIVE_LAZY_RESOURCES
    });
};