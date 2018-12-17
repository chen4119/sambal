export const UPDATE_LOCATION = 'UPDATE_LOCATION';
export const UPDATE_SCREEN_SIZE = 'UPDATE_SCREEN_SIZE';

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