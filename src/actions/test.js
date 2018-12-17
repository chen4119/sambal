export const OPEN_SNACKBAR = 'OPEN_SNACKBAR';
export const CLOSE_SNACKBAR = 'CLOSE_SNACKBAR';


export const showSnackbar = () => (dispatch) => {
    dispatch({
        type: OPEN_SNACKBAR
    });
};
