import { styled, Typography } from "@mui/material";
import { Container, List, LoadMore, Page, Search } from "components";
import { useDaosQuery } from "query/queries";
import {
  StyledEmptyText,
  StyledFlexColumn,
  StyledFlexRow,
  StyledSkeletonLoader,
} from "styles";
import { StyledDao, StyledDaoContent, StyledDaosList } from "./styles";
import { nFormatter } from "utils";
import { Dao } from "types";
import { useMemo, useState } from "react";
import _ from "lodash";
import { DAOS_LIMIT, useDaosListLimit } from "./store";
import { useTranslation } from "react-i18next";
import { DAOS_PAGE_REFETCH_INTERVAL } from "config";
import { useAppQueryParams } from "hooks";
import { DaoListItem } from "./Dao";
import { useDaosPageTranslations } from "i18n/hooks/useDaosPageTranslations";

const filterDaos = (daos: Dao[], searchValue: string) => {
  if (!searchValue) return daos;
  const nameFilter = _.filter(daos, (it) =>
    it.daoMetadata.name.toLowerCase().includes(searchValue.toLowerCase())
  );
  const addressFilter = _.filter(daos, (it) =>
    it.daoAddress.toLowerCase().includes(searchValue.toLowerCase())
  );

  return _.uniqBy([...nameFilter, ...addressFilter], "daoAddress");
};

export function DaosPage() {
  const {
    data = [],
    isLoading,
    dataUpdatedAt,
  } = useDaosQuery(DAOS_PAGE_REFETCH_INTERVAL);
  const { limit, loadMore } = useDaosListLimit();
  const [searchValue, setSearchValue] = useState("");

  const { query, setSearch } = useAppQueryParams();

  const onSearchInputChange = (value: string) => {
    setSearchValue(value);
    setSearch(value);
  };
  const translations = useDaosPageTranslations()

  const filteredDaos = useMemo(
    () => filterDaos(data, searchValue),
    [searchValue, dataUpdatedAt]
  );

  const emptyList = !isLoading && !_.size(filteredDaos);
  return (
    <Page hideBack={true}>
      <StyledFlexColumn alignItems="flex-start" gap={24}>
        <StyledFlexRow justifyContent="space-between">
          <StyledSearch
            initialValue={query.search || ""}
            onChange={onSearchInputChange}
            placeholder={translations.searchForDAO}
          />
          <StyledDaosAmount>
            {nFormatter(_.size(data))} {translations.spaces}
          </StyledDaosAmount>
        </StyledFlexRow>
        <StyledFlexColumn gap={25}>
          <List
            isLoading={isLoading}
            isEmpty={!!emptyList}
            loader={<ListLoader />}
            emptyComponent={
              <StyledEmptyList>
                <StyledFlexRow>
                  <StyledEmptyText>{translations.noSpaces}</StyledEmptyText>
                </StyledFlexRow>
              </StyledEmptyList>
            }
          >
            <StyledDaosList>
              {filteredDaos.map((dao, index) => {
                if (index > limit) return null;
                return <DaoListItem key={dao.daoAddress} dao={dao} />;
              })}
            </StyledDaosList>
          </List>

          <LoadMore
            totalItems={_.size(filteredDaos)}
            amountToShow={limit}
            showMore={loadMore}
            limit={DAOS_LIMIT}
          />
        </StyledFlexColumn>
      </StyledFlexColumn>
    </Page>
  );
}

const StyledEmptyList = styled(Container)({
  width: "100%",
});

const StyledDaosAmount = styled(Typography)({
  fontSize: 15,
  fontWeight: 700,
});

const StyledSearch = styled(Search)({
  maxWidth: 400,
  width: "100%",
});

const ListLoader = () => {
  return (
    <StyledDaosList>
      {_.range(0, 1).map((it, i) => {
        return (
          <StyledDao key={i}>
            <StyledDaoContent>
              <StyledFlexColumn>
                <StyledSkeletonLoader
                  style={{ borderRadius: "50%", width: 70, height: 70 }}
                />
                <StyledSkeletonLoader style={{ width: "70%" }} />
                <StyledSkeletonLoader />
              </StyledFlexColumn>
            </StyledDaoContent>
          </StyledDao>
        );
      })}
    </StyledDaosList>
  );
};
