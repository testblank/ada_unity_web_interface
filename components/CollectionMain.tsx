import * as React from 'react';
import * as BPromise from 'bluebird';
import * as AEvent from 'src/app/event';
import { useEffect, useRef } from 'react';
import { useAdaState } from 'src/app/hooks/useAdaState';
import { useRootState } from 'src/app/hooks/useRootState';
import { useLookbookState } from 'src/app/hooks/useLookbookState';
import { usePVC } from 'src/app/pvc/v3';

import LookBookApi, { ILookBook } from 'app/api/lookBook/lookBookApi';
import AdaEvent from 'src/app/event/eventType/adaEvent';
import { CollectionMainDataManager } from 'src/app/data/content/collectionMain';
import { globalUserData } from 'src/app/data/sync/UserData';
import { getStampBalance, setStampBalance } from 'src/app/data/sync/StampBalance';
import { SkinType } from 'src/app/component/Header/v2';
import { PAGE_ROUTES } from 'app/page/routeInfos';
import { SoundTouch } from 'src/util/sound';
import { Loading } from 'src/app/component';
import { Localize } from 'src/localize';
import { LookBookCollectionPromotionPath, LookBookCollectionBgPath } from 'src/env/resourcePath';
import { LOOKBOOK_TAB } from 'app/page/LookBook';
import { getStaticValue } from 'src/static';
import { IPartsWithStamp } from 'src/app/data/sync/PartsItemWithStampInfo';
import { IFireBaseEvent } from 'src/app/data/content/dataType';
import {
  initBaseLookBookData,
  parsingLookBookPromitionInfo,
  parsingLookBookCollectionListInfo,
  getLookBookNewCollectionListInfo,
  getLookBookCollectionListInfo,
  ILookBookPromotion,
  ILookBookCollection,
} from 'app/data/custom/lookBook';

import Header from 'app/component/Header/v2/type/MoneyShopHeader';
import SwipeGallery, { IRefSwipeGallary } from 'src/app/component/CommonSwipeGallery';
import CollectionCard from 'src/app/component/LookBookCard/Collection/CollectionCard';
import PromotionCard from 'src/app/component/LookBookCard/Collection/PromotionCard';
import Style from './index.scss';

interface IProps {
  collectionMainData: CollectionMainDataManager;
}

interface IState {
  lookBookApiData: ILookBook;

  promotionIndex: number;
  promotion: ILookBookPromotion[];
  newCollectionList: Array<ILookBookCollection & { completedLookCount?: number }>;
  collectionList: Array<ILookBookCollection & { completedLookCount?: number }>;

  ready: boolean;
}

export default React.forwardRef((props: IProps, ref) => {
  const {
    render,
    showErrorScreen,
    ADARouter,
  } = usePVC(props, ref);

  const swipeGallery = useRef<IRefSwipeGallary>();

  const { rootState, dispatch, actions } = useRootState();
  const { lookbookState, lookbookDispatch, lookbookActions, lookbookUtils } = useLookbookState();

  const [state, setState] = useAdaState<IState>({
    lookBookApiData: {
      gold: 0,
      cash: 0,
      exp: 0,
      ticket: 0,
      stampBalance: [],
      completeCollectionIdList: [],
      completeLookIdList: [],
      bookmarkList: [],
    },
    promotionIndex: 0,
    promotion: [],
    newCollectionList: [],
    collectionList: [],
    ready: false,
  });

  useEffect(() => {
    initPage();
  }, []);

  useEffect(() => {
    const newCollectionList = lookbookUtils.setCompletedLookCount(state.current.newCollectionList);
    const collectionList = lookbookUtils.setCompletedLookCount(state.current.collectionList);

    setState({
      ...state.current,
      newCollectionList,
      collectionList,
    });
  }, [rootState.ownedItems]);

  const initPage = async () => {
    const { collectionMainData } = props;

    collectionMainData.getDispatcher().sendFireBasePageEvent({
      eventId: 'lookbook_adacollection_page',
    });

    try {
      const [
        ,
        ,
        promotion,
        lookBookApiData,
      ] = await BPromise.all([
        initBaseLookBookData(collectionMainData),
        parsingLookBookCollectionListInfo(),
        parsingLookBookPromitionInfo(),
        callLookBookApi(),
      ]);

      lookbookDispatch(
        lookbookActions.init({
          dataManager: collectionMainData,
          bookmarkList: lookBookApiData.bookmarkList,
          completedLookList: lookBookApiData.completeLookIdList,
          completedCollectionList: lookBookApiData.completeCollectionIdList,
        }),
      );

      let newCollectionList: IState['collectionList'] = getLookBookNewCollectionListInfo();
      let collectionList: IState['newCollectionList'] = getLookBookCollectionListInfo();

      newCollectionList = lookbookUtils.setCompletedLookCount(newCollectionList);
      collectionList = lookbookUtils.setCompletedLookCount(collectionList);

      setState({
        ...state.current,
        lookBookApiData,
        promotion,
        newCollectionList,
        collectionList,
        ready: true,
      });
    }
    catch (error) {
      console.error(error);
      showErrorScreen(() => initPage());
    }
  };

  const callLookBookApi = async () => {
    const lookBookApi = new LookBookApi();
    try {
      await lookBookApi.request();
      return BPromise.resolve(lookBookApi.getData());
    }
    catch (error) {
      return BPromise.reject(error);
    }
  };

  const callbackIndexChanged = (promotionIndex: number) => {
    setState({ ...state.current, promotionIndex });
  };

  const callBackOnClickPromotion = async (promoId: number) => {
    SoundTouch();
    const { collectionMainData } = props;
    const { bookmarkList } = state.current.lookBookApiData;
    // const collectionLookInfo = await getCollectionLookTableByLookId(promotion.collectionLookId);
    const promotion = state.current.promotion.find((promo: ILookBookPromotion) => {
      return promo.id === promoId;
    });

    ADARouter.navigate(PAGE_ROUTES.PromotionLookDetail, {
      collectionMainData,
      promotion,
      bookmarkList,
    });
  };

  const callBackOnClickCard = (collection: ILookBookCollection) => {
    SoundTouch();
    const { collectionMainData } = props;
    const { bookmarkList } = state.current.lookBookApiData;

    const log: IFireBaseEvent = { eventId: 'lookbook_adacollection_select', eventParam: [`${collection.id}`] };
    props.collectionMainData && props.collectionMainData.getDispatcher().sendFireBaseClickEvent(log);

    ADARouter.navigate(PAGE_ROUTES.CollectionDetailAda, {
      collectionMainData,
      bookmarkList,
      callType: LOOKBOOK_TAB.COLLECTION,
      collectionId: collection.id,
      collectionData: collection,
      callBackUpdate: () => { },
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const pageRender = () => {
    const { collectionMainData } = props;
    const { promotion, newCollectionList, collectionList, promotionIndex } = state.current;
    const imageAddress = collectionMainData.getWebResourceUrl();
    const promitionImageAddress = `${imageAddress}${LookBookCollectionPromotionPath()}`;
    const collectionImageAddress = `${imageAddress}${LookBookCollectionBgPath()}`;
    const delay = getStaticValue('LookBook_Promotion_passovertime');

    const width = (window.innerWidth / 2) - 1.5;
    const height = width * 4 / 3;

    return (
      <div className={Style['look-book-collection']}>
        {
          promotion.length > 0 &&
          <div className={Style.promotion}>
            <SwipeGallery
              ref={swipeGallery}
              width={window.innerWidth}
              callbackIndexChanged={callbackIndexChanged}
              option={{
                autoSwipe: true,
                autoSwipeDelay: delay ? delay : 3000,
              }}
            >
              {
                promotion.map((promo, index: number) => {
                  return (
                    <React.Fragment key={`key${promo.id}_${index}`}>
                      <PromotionCard
                        userData={globalUserData.getManager()}
                        collectionMainData={props.collectionMainData}
                        width={window.innerWidth}
                        height={Math.floor(window.innerWidth * 0.563)}
                        promotion={promo}
                        imgUrl={`${promitionImageAddress}${promo.promotionBanner}.jpg`}
                        cbOnClickCard={() => callBackOnClickPromotion(promo.id)}
                      />
                    </React.Fragment>
                  );
                })
              }
            </SwipeGallery>

            <div className={Style.promotion__indicator} >
              {
                promotion.map((info, index: number) => (
                  <div key={`${info.id}_${index}`} className={Style.indicator} style={promotionIndex === index ? { backgroundColor: 'white' } : null} />
                ))
              }
            </div>
          </div>
        }

        {
          newCollectionList.length > 0 &&
          <div className={Style['new-collection']}>
            <div className={Style['new-collection__title']} >
              <Localize id={'UI_LOOKBOOK_TEXT_NEWCOLLECTION'} />
            </div>
            <div className={Style['new-collection__desc']}>
              <Localize id={'UI_LOOKBOOK_TEXT_DESCNEWCOLLECTION'} />
            </div>
            <div className={Style['new-collection__ary']} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
              <div className={Style['new-collection__ary__wrap']}>
                {
                  newCollectionList.map((coll, index: number) => (
                    <React.Fragment key={`${coll.id}_${index}`}>
                      <CollectionCard
                        className={Style['collection-card']}
                        id={coll.id}
                        width={width}
                        height={height}
                        collectionType={coll.collectionType}
                        imgUrl={`${collectionImageAddress}${coll.collectionIcon}_thumbnail.jpg`}
                        title={coll.collectionTitle}
                        lookCount={coll.looks.length}
                        lookCompletedCount={coll.completedLookCount}
                        rewardComplete={lookbookState.completedCollectionListMap[coll.id]}
                        cbOnClickCard={() => { callBackOnClickCard(coll); }}
                      />
                    </React.Fragment>
                  ))
                }
              </div>
            </div>
          </div>
        }

        {
          collectionList.length > 0 &&
          <div className={Style['collection-list']}>
            <div className={Style.collection__title}>
              <Localize id={'UI_LOOKBOOK_TEXT_ALLCOLLECTION'} />
            </div>
            <div className={Style.collection__desc}>
              <Localize id={'UI_LOOKBOOK_TEXT_ALLDESCCOLLECTION'} />
            </div>
            <div className={Style.collection__ary}>
              <div className={Style.collection__ary__wrap}>
                {
                  collectionList.map((coll, index: number) => (
                    <React.Fragment key={`${coll.id}_${index}`}>
                      <CollectionCard
                        key={`${coll.id}_${index}`}
                        className={Style['collection-card']}
                        id={coll.id}
                        width={width}
                        height={height}
                        imgUrl={`${collectionImageAddress}${coll.collectionIcon}_thumbnail.jpg`}
                        title={coll.collectionTitle}
                        lookCount={coll.looks.length}
                        lookCompletedCount={coll.completedLookCount}
                        rewardComplete={lookbookState.completedCollectionListMap[coll.id]}
                        collectionType={coll.collectionType}
                        cbOnClickCard={() => { callBackOnClickCard(coll); }}
                      />
                    </React.Fragment>
                  ))
                }
              </div>
            </div>
          </div>
        }
      </div>
    );
  };

  return render({
    header: () =>
      <Header
        dataManager={props.collectionMainData}
        skinType={SkinType.NewWhite}
      />,
    page: () =>
      state.current.ready &&
      pageRender(),
  });
});