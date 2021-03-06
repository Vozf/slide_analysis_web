import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, toArray, mergeMap } from 'rxjs/operators';
import { Image, FileApiResponse, FolderApiResponse, ImageListItems } from './image.interface';
import { ImageService } from './image.service';
import { from } from 'rxjs/internal/observable/from';
import { ConnectableObservable, forkJoin, partition, Subject } from 'rxjs';
import { multicast } from 'rxjs/internal/operators/multicast';


@Injectable()
export class ImagePreviewService {

    constructor(private http: HttpClient, private imageService: ImageService) {
    }

    getPreviews(search = ''): Observable<ImageListItems> {
        const items = this.http.get<(FileApiResponse | FolderApiResponse)[]>('images/previews',
            { params: new HttpParams().append('search', search) }).pipe(
            mergeMap(its => from(its)),
            multicast(() => new Subject<FileApiResponse | FolderApiResponse>()),
        ) as ConnectableObservable<FileApiResponse | FolderApiResponse>;
        items.connect();

        return this.getPreviewsRecursive(items);
    }

    private getPreviewsRecursive(items: Observable<(FileApiResponse | FolderApiResponse)>): Observable<ImageListItems> {
        const [folders, images] = partition(items, ({ is_folder }) => is_folder);
        const imagesPreviews = (images as Observable<FileApiResponse>).pipe(
            mergeMap(img => this.getPreview(img)),
            toArray(),
        );

        const folderPreviews = (folders as Observable<FolderApiResponse>).pipe(
            mergeMap(({ children, ...props }) => this.getPreviewsRecursive(from(children)).pipe(
                map(childrenPreviews => ({ children: childrenPreviews, ...props })),
                ),
            ),
            toArray(),
        );

        return forkJoin([folderPreviews, imagesPreviews]).pipe(
            map(([folds, imgs]) => [...folds, ...imgs]),
        );

    }

    getPreview(file: FileApiResponse): Observable<Image> {
        return this.http.get(`images/previews/${file.name}`, { responseType: 'blob' }).pipe(
            mergeMap(image => this.imageService.getBase64FromBlob(image)),
            map(base64 => ({ base64, ...file })),
        );
    }

}
