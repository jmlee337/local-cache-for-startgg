import { DbPool, DbSeed, DbSet, TiebreakMethod } from '../common/types';

type StandingData = {
  setsWon: number;
  gamesPlayed: number;
  gamesWon: number;
  gameWinRatio: number;
  beatenEntrantIds: Set<number>;
  h2hPoints: number | null;
};
function newStandingData(): StandingData {
  const standingData: StandingData = {
    setsWon: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gameWinRatio: 0,
    beatenEntrantIds: new Set(),
    h2hPoints: null,
  };
  return standingData;
}

type SortableEntrant = {
  entrantId: number;
  standingData: StandingData;
};
type TieSegment = {
  start: number;
  end: number;
};

type SortFunction = (
  sortableEntrants: SortableEntrant[],
  sortFunctions: SortFunction[],
) => void;

function sortBySetWins(
  sortableEntrants: SortableEntrant[],
  sortFunctions: SortFunction[],
) {
  sortableEntrants.sort(
    (a, b) => b.standingData.setsWon - a.standingData.setsWon,
  );

  let start = 0;
  let compareSetsWon = sortableEntrants[0].standingData.setsWon;
  const tieSegments: TieSegment[] = [];
  for (let i = 1; i < sortableEntrants.length; i += 1) {
    const { setsWon } = sortableEntrants[i].standingData;
    if (compareSetsWon !== setsWon) {
      if (start < i - 1) {
        tieSegments.push({ start, end: i });
      }
      start = i;
      compareSetsWon = setsWon;
    }
  }
  if (start !== sortableEntrants.length - 1) {
    tieSegments.push({ start, end: sortableEntrants.length });
  }

  if (tieSegments.length > 0) {
    for (const tieSegment of tieSegments) {
      const pre = sortableEntrants.slice(0, tieSegment.start);
      const post = sortableEntrants.slice(tieSegment.end);
      const toSort = sortableEntrants.slice(tieSegment.start, tieSegment.end);
      sortFunctions[0](toSort, sortFunctions.slice(1));
      sortableEntrants.length = 0;
      sortableEntrants.push(...pre, ...toSort, ...post);
    }
  }
}

function sortByGameWins(
  sortableEntrants: SortableEntrant[],
  sortFunctions: SortFunction[],
) {
  sortableEntrants.sort(
    (a, b) => b.standingData.gameWinRatio - a.standingData.gameWinRatio,
  );

  let start = 0;
  let compareGameWinRatio = sortableEntrants[0].standingData.gameWinRatio;
  const tieSegments: TieSegment[] = [];
  for (let i = 1; i < sortableEntrants.length; i += 1) {
    const { gameWinRatio } = sortableEntrants[i].standingData;
    if (compareGameWinRatio !== gameWinRatio) {
      if (start < i - 1) {
        tieSegments.push({ start, end: i });
      }
      start = i;
      compareGameWinRatio = gameWinRatio;
    }
  }
  if (start !== sortableEntrants.length - 1) {
    tieSegments.push({ start, end: sortableEntrants.length });
  }

  if (tieSegments.length > 0) {
    for (const tieSegment of tieSegments) {
      const pre = sortableEntrants.slice(0, tieSegment.start);
      const post = sortableEntrants.slice(tieSegment.end);
      const toSort = sortableEntrants.slice(tieSegment.start, tieSegment.end);
      sortFunctions[0](toSort, sortFunctions.slice(1));
      sortableEntrants.length = 0;
      sortableEntrants.push(...pre, ...toSort, ...post);
    }
  }
}

function sortByHeadToHead(
  sortableEntrants: SortableEntrant[],
  sortFunctions: SortFunction[],
) {
  sortableEntrants.forEach((entrant) => {
    entrant.standingData.h2hPoints = 0;
    sortableEntrants.forEach((oppEntrant) => {
      if (entrant.standingData.beatenEntrantIds.has(oppEntrant.entrantId)) {
        (entrant.standingData.h2hPoints as number) += 1;
      }
    });
  });
  sortableEntrants.sort(
    (a, b) =>
      (b.standingData.h2hPoints as number) -
      (a.standingData.h2hPoints as number),
  );

  let start = 0;
  let compareH2hScore = sortableEntrants[0].standingData.h2hPoints as number;
  const tieSegments: TieSegment[] = [];
  for (let i = 1; i < sortableEntrants.length; i += 1) {
    const h2hScore = sortableEntrants[i].standingData.h2hPoints as number;
    if (compareH2hScore !== h2hScore) {
      if (start < i - 1) {
        tieSegments.push({ start, end: i });
      }
      start = i;
      compareH2hScore = h2hScore;
    }
  }
  if (start !== sortableEntrants.length - 1) {
    tieSegments.push({ start, end: sortableEntrants.length });
  }

  if (tieSegments.length > 0) {
    for (const tieSegment of tieSegments) {
      const pre = sortableEntrants.slice(0, tieSegment.start);
      const post = sortableEntrants.slice(tieSegment.end);
      const toSort = sortableEntrants.slice(tieSegment.start, tieSegment.end);
      sortFunctions[0](toSort, sortFunctions.slice(1));
      sortableEntrants.length = 0;
      sortableEntrants.push(...pre, ...toSort, ...post);
    }
  }
}

function toSortFunction(tiebreakMethod: TiebreakMethod) {
  if (tiebreakMethod === TiebreakMethod.WINS) {
    return sortBySetWins;
  }
  if (tiebreakMethod === TiebreakMethod.GAME_RATIO) {
    return sortByGameWins;
  }
  if (tiebreakMethod === TiebreakMethod.HEAD_TO_HEAD) {
    return sortByHeadToHead;
  }
  throw new Error('unreachable');
}

export default function getPlacementToSortableEntrant(
  dbPool: DbPool,
  dbSets: DbSet[],
  dbSeeds: DbSeed[],
): Map<number, SortableEntrant> {
  if (dbPool.bracketType !== 3) {
    throw new Error(
      `wrong bracketType: ${dbPool.bracketType} for pool: ${dbPool.id}`,
    );
  }
  if (dbPool.tiebreakMethod1 === null) {
    throw new Error(`no tiebreak methods for pool: ${dbPool.id}`);
  }
  if (dbSeeds.some((dbSeed) => dbSeed.entrantId === null)) {
    throw new Error(`missing entrant seeds for pool: ${dbPool.id}`);
  }

  const sortFunctions = [toSortFunction(dbPool.tiebreakMethod1)];
  if (dbPool.tiebreakMethod2) {
    sortFunctions.push(toSortFunction(dbPool.tiebreakMethod2));
  }
  if (dbPool.tiebreakMethod3) {
    sortFunctions.push(toSortFunction(dbPool.tiebreakMethod3));
  }
  const entrantIdToGroupSeedNum = new Map(
    dbSeeds.map((dbSeed) => [dbSeed.entrantId!, dbSeed.groupSeedNum]),
  );
  sortFunctions.push((sortableEntrants: SortableEntrant[]) => {
    sortableEntrants.sort(
      (a, b) =>
        entrantIdToGroupSeedNum.get(a.entrantId)! -
        entrantIdToGroupSeedNum.get(b.entrantId)!,
    );
  });

  const entrantIdToStandingData = new Map<number, StandingData>();
  dbSets.forEach((dbSet) => {
    if (
      !dbSet.entrant1Id ||
      !dbSet.entrant2Id ||
      dbSet.state !== 3 ||
      !dbSet.winnerId
    ) {
      return;
    }

    const entrant1Score = dbSet.entrant1Score ?? 0;
    const entrant2Score = dbSet.entrant2Score ?? 0;
    const totalGames = entrant1Score + entrant2Score;

    let entrant1StandingData = entrantIdToStandingData.get(dbSet.entrant1Id);
    if (!entrant1StandingData) {
      entrant1StandingData = newStandingData();
      entrantIdToStandingData.set(dbSet.entrant1Id, entrant1StandingData);
    }
    entrant1StandingData.gamesPlayed += totalGames;
    entrant1StandingData.gamesWon += entrant1Score;
    if (dbSet.winnerId === dbSet.entrant1Id) {
      entrant1StandingData.setsWon += 1;
      entrant1StandingData.beatenEntrantIds.add(dbSet.entrant2Id);
    }
    entrant1StandingData.gameWinRatio =
      entrant1StandingData.gamesPlayed > 0
        ? entrant1StandingData.gamesWon / entrant1StandingData.gamesPlayed
        : 0;

    let entrant2StandingData = entrantIdToStandingData.get(dbSet.entrant2Id);
    if (!entrant2StandingData) {
      entrant2StandingData = newStandingData();
      entrantIdToStandingData.set(dbSet.entrant2Id, entrant2StandingData);
    }
    entrant2StandingData.gamesPlayed += totalGames;
    entrant2StandingData.gamesWon += entrant2Score;
    if (dbSet.winnerId === dbSet.entrant2Id) {
      entrant2StandingData.setsWon += 1;
      entrant2StandingData.beatenEntrantIds.add(dbSet.entrant1Id);
    }
    entrant2StandingData.gameWinRatio =
      entrant2StandingData.gamesPlayed > 0
        ? entrant2StandingData.gamesWon / entrant2StandingData.gamesPlayed
        : 0;
  });
  const sortableEntrants = Array.from(entrantIdToStandingData.entries()).map(
    ([entrantId, standingData]): SortableEntrant => ({
      entrantId,
      standingData,
    }),
  );
  if (sortableEntrants.length > 0) {
    sortFunctions[0](sortableEntrants, sortFunctions.slice(1));
  }

  return new Map(
    sortableEntrants.map((sortableEntrant, i) => [i + 1, sortableEntrant]),
  );
}
