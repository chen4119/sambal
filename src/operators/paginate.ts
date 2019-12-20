import {Observable} from "rxjs";

export function paginate() {
    return (observable) => new Observable(observer => {
        let prevPage = null;
        let currentItemCount = 1;
        let currentPageCount = 1;
        const subscription = observable.subscribe({
            next(value) {
                const currentPage = {
                    page: currentPageCount,
                    begin: currentItemCount,
                    end: currentItemCount + value.length - 1,
                    items: value,
                    hasNext: true
                };
                if (prevPage !== null) {
                    observer.next(prevPage);
                }
                prevPage = currentPage;
                currentItemCount = currentPage.end + 1;
                currentPageCount++;
            },
            error(err) {
                observer.error(err);
            },
            complete() {
                if (prevPage !== null) {
                    prevPage.hasNext = false;
                    observer.next(prevPage);
                }
                observer.complete();
            }
        });
        return () => {
            subscription.unsubscribe();
        }
    });
}