/*
 * Sonatype Nexus (TM) Open Source Version
 * Copyright (c) 2008-present Sonatype, Inc.
 * All rights reserved. Includes the third-party code listed at http://links.sonatype.com/products/nexus/oss/attributions.
 *
 * This program and the accompanying materials are made available under the terms of the Eclipse Public License Version 1.0,
 * which accompanies this distribution and is available at http://www.eclipse.org/legal/epl-v10.html.
 *
 * Sonatype Nexus (TM) Professional Version is available from Sonatype, Inc. "Sonatype" and "Sonatype Nexus" are trademarks
 * of Sonatype, Inc. Apache Maven is a trademark of the Apache Software Foundation. M2eclipse is a trademark of the
 * Eclipse Foundation. All other trademarks are the property of their respective owners.
 */
package org.sonatype.nexus.repository.content.kv;

import java.util.Optional;

import javax.inject.Inject;
import javax.inject.Named;

import org.sonatype.nexus.common.entity.Continuation;
import org.sonatype.nexus.common.property.SystemPropertiesHelper;
import org.sonatype.nexus.datastore.api.DataSessionSupplier;
import org.sonatype.nexus.repository.content.store.ContentStoreSupport;
import org.sonatype.nexus.transaction.Transactional;

import com.google.inject.assistedinject.Assisted;

@Named
public class KeyValueStore<T extends KeyValueDAO>
   extends ContentStoreSupport<T>
{
  private static final int DELETE_BATCH_SIZE_DEFAULT =
      SystemPropertiesHelper.getInteger("nexus.content.deleteBatchSize", 1000);

  @Inject
  public KeyValueStore(
      final DataSessionSupplier sessionSupplier,
      @Assisted final String contentStoreName,
      @Assisted final Class<T> daoClass)
  {
    super(sessionSupplier, contentStoreName, daoClass);
  }

  @Transactional
  public Optional<String> get(final int repositoryId, final String type, final String key) {
    return dao().get(repositoryId, type, key);
  }

  @Transactional
  public void set(final int repositoryId, final String type, final String key, final String value) {
    dao().set(repositoryId, type, key, value);
  }

  @Transactional
  public void remove(final int repositoryId, final String type, final String key) {
    dao().remove(repositoryId, type, key);
  }

  public void removeAll(final int repositoryId, final String type) {
    int count;
    do {
      count = removeCategoryPage(repositoryId, type);
    }
    while (count > 0);
  }

  @Transactional
  protected int removeCategoryPage(final int repositoryId, final String type) {
    return dao().removeAll(repositoryId, type, DELETE_BATCH_SIZE_DEFAULT);
  }

  public void removeRepository(final int repositoryId) {
    int count;
    do {
      count = removeRepositoryPage(repositoryId);
    }
    while (count > 0);
  }

  @Transactional
  protected int removeRepositoryPage(final int repositoryId) {
    return dao().removeRepository(repositoryId, DELETE_BATCH_SIZE_DEFAULT);
  }

  @Transactional
  public Continuation<KeyValue> browse(
      final int repositoryId,
      final String type,
      final int limit,
      final String continuationToken)
  {
    return dao().browse(repositoryId, type, limit, continuationToken);
  }

  /**
   * Browse all entries within the repository.
   */
  @Transactional
  public int count(
      final int repositoryId,
      final String type)
  {
    return dao().count(repositoryId, type);
  }
}
